// AgentCheck frontend — static, no backend, no server.
// The user always confirms transactions in their own wallet. This page
// never bypasses confirmation, never stores a login session, and never
// asks for a seed phrase, private key, or pairing code.

let provider = null;      // read-only public RPC
let walletProvider = null; // injected wallet (window.ethereum)
let signer = null;
let userAddress = null;
let checkInContract = null;
let agentIdContract = null;
let abi = null;

const $ = (id) => document.getElementById(id);

function setStatus(text, kind) {
  const el = $("status");
  el.textContent = text;
  el.className = "status " + (kind || "");
}

function shortAddr(a) {
  return a ? a.slice(0, 6) + "…" + a.slice(-4) : "—";
}

async function loadAbi() {
  const res = await fetch("abi.json");
  abi = await res.json();
}

function isDeployed() {
  return CONFIG.CONTRACT_ADDRESS &&
    CONFIG.CONTRACT_ADDRESS !== "0x0000000000000000000000000000000000000000";
}

async function initReadOnly() {
  provider = new ethers.JsonRpcProvider(CONFIG.RPC_URL);
  agentIdContract = new ethers.Contract(CONFIG.AGENT_ID_ADDRESS, CONFIG.AGENT_ID_ABI, provider);
  if (isDeployed()) {
    checkInContract = new ethers.Contract(CONFIG.CONTRACT_ADDRESS, abi, provider);
    await loadGlobalStats();
    await loadLeaderboard();
  } else {
    $("global-stats").innerHTML =
      "<p class=\"muted\">Contract not deployed yet. Check back after launch.</p>";
    $("leaderboard-body").innerHTML =
      "<tr><td colspan=\"4\" class=\"muted\">Leaderboard appears once the contract is live.</td></tr>";
  }
}

async function loadGlobalStats() {
  try {
    const [users, total] = await Promise.all([
      checkInContract.totalUsers(),
      checkInContract.totalCheckIns(),
    ]);
    $("stat-users").textContent = users.toString();
    $("stat-checkins").textContent = total.toString();
  } catch (e) {
    console.error("global stats failed", e);
    // Honest empty state: no invented numbers, just say it is unavailable.
    $("stat-users").textContent = "Unavailable";
    $("stat-checkins").textContent = "Unavailable";
  } finally {
    $("stat-users").classList.remove("is-loading");
    $("stat-checkins").classList.remove("is-loading");
  }
}

async function loadUserState() {
  if (!userAddress || !checkInContract) return;
  try {
    const [agentBal, streak, points, total, checkedToday] = await Promise.all([
      agentIdContract.balanceOf(userAddress),
      checkInContract.getStreak(userAddress),
      checkInContract.getPoints(userAddress),
      checkInContract.getTotalCheckIns(userAddress),
      checkInContract.hasCheckedInToday(userAddress),
    ]);
    const holds = agentBal > 0n;
    $("agent-status").textContent = holds
      ? "Agent ID holder ✓ (" + agentBal.toString() + ")"
      : "No Agent ID found";
    $("agent-status").className = holds ? "ok" : "warn";
    $("user-streak").textContent = streak.toString();
    $("user-points").textContent = points.toString();
    $("user-total").textContent = total.toString();

    const btn = $("checkin-btn");
    if (!holds) {
      btn.disabled = true;
      btn.textContent = "Check in (requires an Agent ID)";
      setStatus("This wallet does not hold an Agent ID. Claim one in the Binance app first.", "warn");
    } else if (checkedToday) {
      btn.disabled = true;
      btn.textContent = "Checked in today ✓";
      setStatus("Already checked in today. Come back tomorrow to extend your streak.", "ok");
    } else {
      btn.disabled = false;
      btn.textContent = "Check in now";
      setStatus("Ready — one check-in per day. Your wallet will ask you to confirm.", "");
    }
  } catch (e) {
    console.error("user state failed", e);
    setStatus("Could not read on-chain state. Check your connection and retry.", "warn");
  }
}

async function loadLeaderboard() {
  const body = $("leaderboard-body");
  try {
    const latest = await provider.getBlockNumber();
    const from = CONFIG.DEPLOY_BLOCK || 0;
    const iface = new ethers.Interface(abi);
    const topic = iface.getEvent("CheckIn").topicHash;
    const perUser = new Map(); // address -> {streak, points, total}

    for (let start = from; start <= latest; start += CONFIG.LOG_CHUNK_BLOCKS) {
      const end = Math.min(start + CONFIG.LOG_CHUNK_BLOCKS - 1, latest);
      const logs = await provider.getLogs({
        address: CONFIG.CONTRACT_ADDRESS,
        fromBlock: start,
        toBlock: end,
        topics: [topic],
      });
      for (const log of logs) {
        const parsed = iface.parseLog(log);
        const user = parsed.args.user;
        const prev = perUser.get(user) || { streak: 0, points: 0, total: 0 };
        prev.streak = Number(parsed.args.streak);
        prev.points = Number(parsed.args.points);
        prev.total += 1;
        perUser.set(user, prev);
      }
    }

    const rows = [...perUser.entries()]
      .map(([user, v]) => ({ user, ...v }))
      .sort((a, b) => b.points - a.points || b.streak - a.streak)
      .slice(0, CONFIG.LEADERBOARD_TOP_N);

    if (rows.length === 0) {
      body.innerHTML = "<tr><td colspan=\"4\" class=\"muted\">No check-ins yet. Be the first.</td></tr>";
      return;
    }
    body.innerHTML = rows.map((r, i) =>
      `<tr${r.user === userAddress ? ' class="me"' : ""}>` +
      `<td>${i + 1}</td>` +
      `<td><a href="${CONFIG.EXPLORER}/address/${r.user}" target="_blank" rel="noopener">${shortAddr(r.user)}</a>${r.user === userAddress ? " (you)" : ""}</td>` +
      `<td>${r.streak}</td><td>${r.points}</td></tr>`
    ).join("");
  } catch (e) {
    console.error("leaderboard failed", e);
    body.innerHTML = "<tr><td colspan=\"4\" class=\"muted\">Leaderboard could not load (public RPC busy). <button type=\"button\" class=\"btn-link\" data-action=\"retry-leaderboard\">Retry</button></td></tr>";
  }
}

async function connectWallet() {
  if (!window.ethereum) {
    setStatus("No wallet found in this browser. Open this page in a wallet browser or install a wallet extension.", "warn");
    return;
  }
  try {
    const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
    walletProvider = new ethers.BrowserProvider(window.ethereum);
    const network = await walletProvider.getNetwork();
    if (Number(network.chainId) !== CONFIG.CHAIN_ID) {
      try {
        await window.ethereum.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: "0x" + CONFIG.CHAIN_ID.toString(16) }],
        });
      } catch (switchErr) {
        setStatus("Please switch your wallet to " + CONFIG.CHAIN_NAME + " (chain " + CONFIG.CHAIN_ID + ").", "warn");
        return;
      }
    }
    signer = await walletProvider.getSigner();
    userAddress = accounts[0];
    document.querySelectorAll(".js-connect").forEach((b) => {
      b.textContent = "Connected: " + shortAddr(userAddress);
    });
    $("wallet-address").textContent = userAddress;
    $("user-panel").classList.remove("hidden");
    if (!isDeployed()) {
      setStatus("Connected. The contract is not deployed yet — check-in opens at launch.", "warn");
      return;
    }
    setStatus("Connected. Reading your on-chain state…", "");
    await loadUserState();
  } catch (e) {
    console.error("connect failed", e);
    setStatus("Connection rejected or failed. Nothing was sent.", "warn");
  }
}

async function doCheckIn() {
  if (!signer || !checkInContract) return;
  const btn = $("checkin-btn");
  btn.disabled = true;
  btn.textContent = "Waiting for wallet confirmation…";
  setStatus("Confirm the transaction in your wallet. Only gas is charged — check-in itself is free.", "");
  try {
    const connected = checkInContract.connect(signer);
    const tx = await connected.checkIn();
    setStatus("Transaction sent: " + tx.hash + " — waiting for confirmation…", "");
    $("tx-link").innerHTML =
      `<a href="${CONFIG.EXPLORER}/tx/${tx.hash}" target="_blank" rel="noopener">View on BscScan ↗</a>`;
    await tx.wait();
    setStatus("Checked in! Your streak and points are updated.", "ok");
    await loadUserState();
    await loadGlobalStats();
    await loadLeaderboard();
  } catch (e) {
    console.error("check-in failed", e);
    const msg = (e && e.reason) || (e && e.message) || "Transaction failed";
    setStatus("Check-in failed: " + msg, "warn");
    btn.disabled = false;
    btn.textContent = "Check in now";
    await loadUserState();
  }
}

window.addEventListener("DOMContentLoaded", async () => {
  $("contract-address").textContent = isDeployed()
    ? CONFIG.CONTRACT_ADDRESS
    : "Not deployed yet";
  if (isDeployed()) {
    $("contract-address").innerHTML =
      `<a href="${CONFIG.EXPLORER}/address/${CONFIG.CONTRACT_ADDRESS}" target="_blank" rel="noopener">${CONFIG.CONTRACT_ADDRESS}</a>`;
  }
  document.querySelectorAll(".js-connect").forEach((b) =>
    b.addEventListener("click", connectWallet)
  );
  const agentBtn = $("agent-btn");
  if (agentBtn) agentBtn.addEventListener("click", () => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    document.getElementById("agent-guide").scrollIntoView({
      behavior: reduceMotion ? "auto" : "smooth",
    });
  });
  const copyBtn = $("copy-prompt-btn");
  const copyStatus = $("copy-status");
  if (copyBtn) copyBtn.addEventListener("click", async () => {
    const text = document.getElementById("agent-prompt").textContent;
    try {
      await navigator.clipboard.writeText(text);
      copyBtn.textContent = "Copied ✓";
      if (copyStatus) copyStatus.textContent = "Prompt copied to clipboard.";
    } catch (e) {
      // Clipboard API unavailable (old browser / non-secure context):
      // select the text so the user can copy it manually.
      const range = document.createRange();
      range.selectNodeContents(document.getElementById("agent-prompt"));
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
      copyBtn.textContent = "Selected — press Ctrl+C";
      if (copyStatus) copyStatus.textContent = "Prompt selected — press Ctrl+C to copy.";
    }
    setTimeout(() => {
      copyBtn.textContent = "Copy prompt";
      if (copyStatus) copyStatus.textContent = "";
    }, 3000);
  });
  // Leaderboard retry (delegated: the button only exists in the error row).
  $("leaderboard-body").addEventListener("click", async (e) => {
    if (e.target && e.target.dataset.action === "retry-leaderboard") {
      $("leaderboard-body").innerHTML =
        "<tr><td colspan=\"4\" class=\"muted\">Loading…</td></tr>";
      await loadLeaderboard();
    }
  });
  $("checkin-btn").addEventListener("click", doCheckIn);
  try {
    await loadAbi();
    await initReadOnly();
  } catch (e) {
    console.error("init failed", e);
    setStatus("Could not reach the public RPC. The page works once the network responds.", "warn");
  }
});
