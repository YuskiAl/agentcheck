# AgentCheck Skill

Do the daily on-chain check-in for AgentCheck — a daily check-in dApp for
Binance Agent ID holders on BNB Smart Chain. One check-in per wallet per
UTC day. Check-in is free: no tokens are sent, only network gas is paid.

## What AgentCheck is

- Site: https://agentcheck-hazel.vercel.app/
- Contract (BNB Smart Chain, chain 56):
  `0x69951ec1e92d9dC5C587cdD672006C04ef32e3D7`
- Contract verified on BscScan (Exact Match, open source).
- Agent ID registry (SPACE ID, ERC-721, non-transferable):
  `0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F`
- Check-in function: `checkIn()` — selector `0x183ff085`.
- Read functions: `hasCheckedInToday(address)`,
  `getStreak(address)`, `getPoints(address)`,
  `getTotalCheckIns(address)`.

## Prerequisites (check these first, in order)

1. The user holds an Agent ID. It can only be claimed in the Binance App
   (Wallet > Agent ID banner). One per user, non-transferable. Verify
   on-chain with `balanceOf(address)` on the Agent ID registry: a value
   greater than 0 means the user holds an Agent ID. If they hold none,
   stop and tell them to claim one first.
2. Developer Mode is enabled on the user's Agentic Wallet. It can only be
   switched on inside the Binance App (Agentic Wallet management page >
   Settings), it is time-limited, and it expires. Check it with
   `baw wallet settings --json` and read `devMode.enabled` and
   `devMode.expiresAt`. If it is disabled or expired, stop and tell the
   user to re-enable it in the App. Do not proceed without it.
3. You have the official Binance Skills available (Binance AI Pro in the
   App, or an agent that ran
   `npx skills add binance/binance-skills-hub/skills/binance-web3/binance-agentic-wallet`).

## Check-in flow (always follow in this order)

1. Check whether the user already checked in today: call
   `hasCheckedInToday(<user's Agentic Wallet address>)` on the
   AgentCheck contract. If they already checked in today, stop and tell
   them — one check-in per day.
2. Preview the check-in (never skip the preview):
   `baw contract-call preview --binanceChainId 56 --from <user's Agentic Wallet address> --to 0x69951ec1e92d9dC5C587cdD672006C04ef32e3D7 --value 0 --inputData 0x183ff085 --json`
   This calls `checkIn()` — one daily check-in, no tokens sent, only
   network gas.
3. Show the user the preview and wait for their explicit confirmation.
   Do not execute before they confirm.
4. After they confirm, execute:
   `baw contract-call execute --requestId <requestId from the preview> --json`
   and show them the transaction hash.
5. Verify on-chain that the streak and points updated (call
   `getStreak(address)` and `getPoints(address)`), and tell the user
   their new streak. They can also see it on the leaderboard at
   https://agentcheck-hazel.vercel.app/.

## Safety rules (never break these)

- Never execute a transaction before the user's explicit confirmation.
  The preview-then-confirm flow is mandatory.
- Never ask the user for a QR code, a pairing code, a seed phrase, a
  private key, or any credential. The Agentic Wallet only signs through
  the user's own agent inside the Binance App.
- Never bypass, hide, or reword a transaction confirmation prompt.
- Never send tokens, approvals, or any other transaction on the user's
  behalf. This skill only ever calls `checkIn()` with value 0.
- If Developer Mode is off or expired, stop. Do not try any workaround.

## Streaks, points, missions, badges

- Streak: consecutive UTC days checked in. Miss a day and the streak
  restarts at 1.
- Points: 1 point per check-in, plus a +5 bonus every 7-day streak.
- The site shows a deterministic daily mission (rotates daily, UTC) and
  streak milestone badges on the leaderboard (7-day, 14-day, 30-day).
  Missions are for fun and sharing only — they never change points.
  Only genuine daily check-ins count; there is no way to buy points or
  a streak.

## Troubleshooting

- `devMode.enabled` is false or `devMode.expiresAt` is in the past:
  the user must re-enable Developer Mode in the Binance App.
- Preview fails with a simulation error: check the user has not already
  checked in today, and that Developer Mode is still active.
- The user has no Agent ID: they must claim one in the Binance App
  first (Wallet > Agent ID banner).
