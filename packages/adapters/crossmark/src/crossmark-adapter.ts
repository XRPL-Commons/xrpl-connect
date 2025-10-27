/**
 * Crossmark Adapter for XRPL
 */

import sdk from '@crossmarkio/sdk';
import type {
  WalletAdapter,
  AccountInfo,
  ConnectOptions,
  NetworkInfo,
  Transaction,
  SignedMessage,
  SubmittedTransaction,
} from '@xrpl-connect/core';
import { createWalletError, STANDARD_NETWORKS } from '@xrpl-connect/core';

/**
 * Crossmark adapter options
 */
export interface CrossmarkAdapterOptions {
  // Currently no specific options needed for Crossmark
}

/**
 * Crossmark adapter implementation
 */
export class CrossmarkAdapter implements WalletAdapter {
  readonly id = 'crossmark';
  readonly name = 'Crossmark';
  readonly icon =
    'data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiPz4KPHN2ZyB2ZXJzaW9uPSIxLjEiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIgd2lkdGg9IjE1MCIgaGVpZ2h0PSIxNDgiPgo8cGF0aCBkPSJNMCAwIEM0OS41IDAgOTkgMCAxNTAgMCBDMTUwIDQ4Ljg0IDE1MCA5Ny42OCAxNTAgMTQ4IEMxMDAuNSAxNDggNTEgMTQ4IDAgMTQ4IEMwIDk5LjE2IDAgNTAuMzIgMCAwIFogIiBmaWxsPSIjRTE0QzQ3IiB0cmFuc2Zvcm09InRyYW5zbGF0ZSgwLDApIi8+CjxwYXRoIGQ9Ik0wIDAgQzMuMTU0NTE2NSAxLjM0NDczMTcyIDUuODE3Mjg5NzcgMy4zMDUxNTA3OSA4LjU3NDIxODc1IDUuMzEyNSBDMTkuNzIxNjI5NDEgMTMuMzg2NTU5MTIgMjguNzgyNDI2MTMgMTQuNjU0ODMzNDcgNDIuMTk5MjE4NzUgMTMuOTM3NSBDNTAuNTE1OTg5OTcgMTIuNTE1MjExNTkgNTguMzgzMTU2NzYgNy41OTg0NjY2MyA2NC41NzQyMTg3NSAyIEM2Ny4xOTkyMTg3NSAtMC4wNjI1IDY3LjE5OTIxODc1IC0wLjA2MjUgNjkuMTU2MjUgMC4xMzY3MTg3NSBDNzEuNDIzOTM1NzIgMS4wMjU1ODIxOCA3Mi43NjEwMjIyNyAyLjAwMTk2NTkyIDc0LjUxMTcxODc1IDMuNjg3NSBDNzUuMzEwMjkyOTcgNC40MjIyNjU2MyA3NS4zMTAyOTI5NyA0LjQyMjI2NTYzIDc2LjEyNSA1LjE3MTg3NSBDNzcuMTk5MjE4NzUgNi45Mzc1IDc3LjE5OTIxODc1IDYuOTM3NSA3Ny4xNDA2MjUgOS4yMTQ4NDM3NSBDNzUuNjgzMDU4OCAxMy40MzAyOTQ1NSA3My4xMjc0ODczOSAxNi44NjQ0NjQ1NyA3MC42MTMyODEyNSAyMC41MDE5NTMxMiBDNjUuNjQ0Nzg3OTggMjcuODk3NDg5OTkgNjMuNjQ1Nzk5NDkgMzQuMzg5NDEyNDEgNjMuNzYxNzE4NzUgNDMuMzEyNSBDNjMuNzc2MzQxNTUgNDQuNTcyNDc4MDMgNjMuNzc2MzQxNTUgNDQuNTcyNDc4MDMgNjMuNzkxMjU5NzcgNDUuODU3OTEwMTYgQzY0LjA5MjU1MDcxIDU2LjM4Nzc3MzE5IDY3LjkyODcwODczIDYzLjIzNzYwNTk3IDc0LjI4ODgxODM2IDcxLjM4NjIzMDQ3IEM3Ni4xODQ1NDY3MSA3My45MDk5NDU4IDc3LjIxMTYzNjA1IDc1LjQwNTg4NDQzIDc3LjEzNjcxODc1IDc4LjYxMzI4MTI1IEM3Ni4xNTk2MjEwOCA4MS4wMzU2NjkyMiA3NS4yMjg5ODA2OCA4Mi40NzQ5MDIwMyA3My4zODY3MTg3NSA4NC4zMTI1IEM3Mi44ODUyNzM0NCA4NC44MzU4NTkzNyA3Mi4zODM4MjgxMiA4NS4zNTkyMTg3NSA3MS44NjcxODc1IDg1Ljg5ODQzNzUgQzcwLjE5OTIxODc1IDg2LjkzNzUgNzAuMTk5MjE4NzUgODYuOTM3NSA2OC4yODkwNjI1IDg2LjgwNDY4NzUgQzY1LjczNzc1NjY4IDg1Ljc0NjAxNDgxIDYzLjc4NTM0MDkxIDg0LjM0NDA0MTAzIDYxLjU3NDIxODc1IDgyLjY4NzUgQzQ5LjgzNTgyNzgyIDc0LjI3MzI1NTE3IDM5LjU2MzA4NzIxIDcxLjkzMTg3OTEyIDI1LjE5OTIxODc1IDcyLjkzNzUgQzE3LjcyNDQ2NzQ4IDc0LjQzNjc2NDY4IDExLjg5MzA0NiA3OS4wNDU3OTE2NiA2LjAxOTI4NzExIDgzLjY3MTM4NjcyIEMxLjc0NTc1MTM4IDg2Ljk0NjIwNTgzIDEuNzQ1NzUxMzggODYuOTQ2MjA1ODMgLTEuMDA3ODEyNSA4Ni45MDIzNDM3NSBDLTIuOTg4MDU0NTYgODUuODM2NzIzMyAtNC40OTE1OTEwNSA4NC43NDg4Mjk1MiAtNi4xMTMyODEyNSA4My4xODc1IEMtNi42NDU2NjQwNiA4Mi42OTc2NTYyNSAtNy4xNzgwNDY4NyA4Mi4yMDc4MTI1IC03LjcyNjU2MjUgODEuNzAzMTI1IEMtOC44MDA3ODEyNSA3OS45Mzc1IC04LjgwMDc4MTI1IDc5LjkzNzUgLTguNzA3MDMxMjUgNzcuNTYyNSBDLTcuNjE1MTk1OTcgNzQuMzk5OTQyNjMgLTYuMDU3NDk4MDMgNzIuMzEzMzcwNjUgLTMuOTg4MjgxMjUgNjkuNjg3NSBDMy44MTAzMTMyNSA1OS4zMDMzNDk5OCA2LjA2Nzg2NDI3IDQ5Ljg2ODg0NTUzIDUuMTk5MjE4NzUgMzYuOTM3NSBDMy43MTgyNjUxNSAyNy44NDc5Nzc0MiAtMS4yMTI1NjMxMyAyMC4yNjYxNDQwOCAtNy4wMTU2MjUgMTMuMjY1NjI1IEMtOC44MDA3ODEyNSAxMC45Mzc1IC04LjgwMDc4MTI1IDEwLjkzNzUgLTguOTI1NzgxMjUgOC41IEMtNy4zNDk5MTAxNyA0LjkxMDUxNTg3IC00LjM4MzcwMTUxIC0wLjE1MjE0NTgyIDAgMCBaICIgZmlsbD0iI0UyNEU0NyIgdHJhbnNmb3JtPSJ0cmFuc2xhdGUoNDAuODAwNzgxMjUsMzIuMDYyNSkiLz4KPHBhdGggZD0iTTAgMCBDMy4xNTQ1MTY1IDEuMzQ0NzMxNzIgNS44MTcyODk3NyAzLjMwNTE1MDc5IDguNTc0MjE4NzUgNS4zMTI1IEMxOS43MjE2Mjk0MSAxMy4zODY1NTkxMiAyOC43ODI0MjYxMyAxNC42NTQ4MzM0NyA0Mi4xOTkyMTg3NSAxMy45Mzc1IEM1MC41MTU5ODk5NyAxMi41MTUyMTE1OSA1OC4zODMxNTY3NiA3LjU5ODQ2NjYzIDY0LjU3NDIxODc1IDIgQzY3LjE5OTIxODc1IC0wLjA2MjUgNjcuMTk5MjE4NzUgLTAuMDYyNSA2OS4xNTYyNSAwLjEzNjcxODc1IEM3MS40MjM5MzU3MiAxLjAyNTU4MjE4IDcyLjc2MTAyMjI3IDIuMDAxOTY1OTIgNzQuNTExNzE4NzUgMy42ODc1IEM3NS4zMTAyOTI5NyA0LjQyMjI2NTYzIDc1LjMxMDI5Mjk3IDQuNDIyMjY1NjMgNzYuMTI1IDUuMTcxODc1IEM3Ny4xOTkyMTg3NSA2LjkzNzUgNzcuMTk5MjE4NzUgNi45Mzc1IDc3LjE0MDYyNSA5LjIxNDg0Mzc1IEM3NS42ODMwNTg4IDEzLjQzMDI5NDU1IDczLjEyNzQ4NzM5IDE2Ljg2NDQ2NDU3IDcwLjYxMzI4MTI1IDIwLjUwMTk1MzEyIEM2NS42NDQ3ODc5OCAyNy44OTc0ODk5OSA2My42NDU3OTk0OSAzNC4zODk0MTI0MSA2My43NjE3MTg3NSA0My4zMTI1IEM2My43NzYzNDE1NSA0NC41NzI0NzgwMyA2My43NzYzNDE1NSA0NC41NzI0NzgwMyA2My43OTEyNTk3NyA0NS44NTc5MTAxNiBDNjQuMDkyNTUwNzEgNTYuMzg3NzczMTkgNjcuOTI4NzA4NzMgNjMuMjM3NjA1OTcgNzQuMjg4ODE4MzYgNzEuMzg2MjMwNDcgQzc2LjE4NDU0NjcxIDczLjkwOTk0NTggNzcuMjExNjM2MDUgNzUuNDA1ODg0NDMgNzcuMTM2NzE4NzUgNzguNjEzMjgxMjUgQzc2LjE1OTYyMTA4IDgxLjAzNTY2OTIyIDc1LjIyODk4MDY4IDgyLjQ3NDkwMjAzIDczLjM4NjcxODc1IDg0LjMxMjUgQzcyLjg4NTI3MzQ0IDg0LjgzNTg1OTM3IDcyLjM4MzgyODEyIDg1LjM1OTIxODc1IDcxLjg2NzE4NzUgODUuODk4NDM3NSBDNzAuMTk5MjE4NzUgODYuOTM3NSA3MC4xOTkyMTg3NSA4Ni45Mzc1IDY4LjI4OTA2MjUgODYuODA0Njg3NSBDNjUuNzM3NzU2NjggODUuNzQ2MDE0ODEgNjMuNzg1MzQwOTEgODQuMzQ0MDQxMDMgNjEuNTc0MjE4NzUgODIuNjg3NSBDNDkuODM1ODI3ODIgNzQuMjczMjU1MTcgMzkuNTYzMDg3MjEgNzEuOTMxODc5MTIgMjUuMTk5MjE4NzUgNzIuOTM3NSBDMTcuNzI0NDY3NDggNzQuNDM2NzY0NjggMTEuODkzMDQ2IDc5LjA0NTc5MTY2IDYuMDE5Mjg3MTEgODMuNjcxMzg2NzIgQzEuNzQ1NzUxMzggODYuOTQ2MjA1ODMgMS43NDU3NTEzOCA4Ni45NDYyMDU4MyAtMS4wMDc4MTI1IDg2LjkwMjM0Mzc1IEMtMi45ODgwNTQ1NiA4NS44MzY3MjMzIC00LjQ5MTU5MTA1IDg0Ljc0ODgyOTUyIC02LjExMzI4MTI1IDgzLjE4NzUgQy02LjY0NTY2NDA2IDgyLjY5NzY1NjI1IC03LjE3ODA0Njg3IDgyLjIwNzgxMjUgLTcuNzI2NTYyNSA4MS43MDMxMjUgQy04LjgwMDc4MTI1IDc5LjkzNzUgLTguODAwNzgxMjUgNzkuOTM3NSAtOC43MDcwMzEyNSA3Ny41NjI1IEMtNy42MTUxOTU5NyA3NC4zOTk5NDI2MyAtNi4wNTc0OTgwMyA3Mi4zMTMzNzA2NSAtMy45ODgyODEyNSA2OS42ODc1IEMzLjgxMDMxMzI1IDU5LjMwMzM0OTk4IDYuMDY3ODY0MjcgNDkuODY4ODQ1NTMgNS4xOTkyMTg3NSAzNi45Mzc1IEMzLjcxODI2NTE1IDI3Ljg0Nzk3NzQyIC0xLjIxMjU2MzEzIDIwLjI2NjE0NDA4IC03LjAxNTYyNSAxMy4yNjU2MjUgQy04LjgwMDc4MTI1IDEwLjkzNzUgLTguODAwNzgxMjUgMTAuOTM3NSAtOC45MjU3ODEyNSA4LjUgQy03LjM0OTkxMDE3IDQuOTEwNTE1ODcgLTQuMzgzNzAxNTEgLTAuMTUyMTQ1ODIgMCAwIFogTS0wLjgwMDc4MTI1IDUuOTM3NSBDLTEuNDYwNzgxMjUgNi41OTc1IC0yLjEyMDc4MTI1IDcuMjU3NSAtMi44MDA3ODEyNSA3LjkzNzUgQy0yLjQ2MzgxNTI5IDExLjU2NTc2MTM1IC0wLjUxMTgyNzg0IDE0LjA1Nzg0MTI1IDEuNTExNzE4NzUgMTcgQzguMzE5MDQ1NjggMjcuNDI3NjUwNyAxMS42ODQ1MDAzOCAzOC40ODQ1NjM1IDkuNzM4MjgxMjUgNTAuODcxMDkzNzUgQzcuODQ2Nzc0NjggNTkuNDI3Mzc5MzUgNC40NTQ1MTI1NyA2Ny4wOTc5MjI2NyAtMS4yMzgyODEyNSA3My44MTI1IEMtMy4xMTg0ODE1IDc1Ljg3ODc2MTMyIC0zLjExODQ4MTUgNzUuODc4NzYxMzIgLTIuNTUwNzgxMjUgNzguNzUgQy0yLjMwMzI4MTI1IDc5LjQ3MTg3NSAtMi4wNTU3ODEyNSA4MC4xOTM3NSAtMS44MDA3ODEyNSA4MC45Mzc1IEMyLjMwMjQ2NDg1IDgwLjM5Mzc4MzY0IDQuNTgyNjIwNyA3OS4xNTY0ODIwOSA3LjgyNDIxODc1IDc2LjYyNSBDMTIuOTc1NTQxODYgNzIuODYzODM5MDUgMTguMTQyMTgyMDcgNzAuODEyMDU3MTEgMjQuMTk5MjE4NzUgNjguOTM3NSBDMjUuNjg0MjE4NzUgNjguNDQyNSAyNS42ODQyMTg3NSA2OC40NDI1IDI3LjE5OTIxODc1IDY3LjkzNzUgQzQxLjYyMjg4NzM4IDY2Ljk5MzQ4NTE2IDUyLjYwNzczOTY1IDcwLjA1NTgyMzY4IDY0LjEzNjcxODc1IDc4Ljg3NSBDNjYuODgxNTA4MyA4MS4xODkzMDk5NSA2Ni44ODE1MDgzIDgxLjE4OTMwOTk1IDY5LjMyODEyNSA4MC43NTM5MDYyNSBDNjkuOTQ1NTg1OTQgODAuNDg0NDkyMTkgNzAuNTYzMDQ2ODcgODAuMjE1MDc4MTMgNzEuMTk5MjE4NzUgNzkuOTM3NSBDNzEuNjk0MjE4NzUgNzguNDUyNSA3MS42OTQyMTg3NSA3OC40NTI1IDcyLjE5OTIxODc1IDc2LjkzNzUgQzcwLjg3ODUwNTUzIDc0LjY0NDg4NDk2IDY5LjUyMDE2NjgxIDcyLjUzNzQ2NDU0IDY4LjAxMTcxODc1IDcwLjM3NSBDNTkuNzUyMjc2ODkgNTcuODgyODkzNDQgNTcuNTcyNTQ5OTQgNDcuNjU4MjI5NyA1OS42MzY3MTg3NSAzMi43ODUxNTYyNSBDNjEuMDgzNzEzODUgMjYuNDgxNjgzODMgNjQuMDI1NDE3MTQgMjEuNTQ4NDE4NzkgNjcuNjc1NzgxMjUgMTYuMjUgQzY5LjM0MzIxNDk5IDEzLjkzNTIyNjY2IDY5LjM0MzIxNDk5IDEzLjkzNTIyNjY2IDcwLjE5OTIxODc1IDEwLjkzNzUgQzcwLjg1OTIxODc1IDEwLjkzNzUgNzEuNTE5MjE4NzUgMTAuOTM3NSA3Mi4xOTkyMTg3NSAxMC45Mzc1IEM3MS43MDQyMTg3NSA4Ljk1NzUgNzEuNzA0MjE4NzUgOC45NTc1IDcxLjE5OTIxODc1IDYuOTM3NSBDNjkuNDQwMzUwMDQgNi4xMzIxNzA4OCA2OS40NDAzNTAwNCA2LjEzMjE3MDg4IDY3LjE5OTIxODc1IDUuOTM3NSBDNjQuODM0MzUyMjkgNy4yMTc4MDQ2IDY0LjgzNDM1MjI5IDcuMjE3ODA0NiA2Mi41MTE3MTg3NSA5LjEyNSBDNTcuOTQ3MzMxODUgMTIuNDk5NTU0MDggNTMuNTA2NTE0NzYgMTQuOTUxOTY5MDUgNDguMTk5MjE4NzUgMTYuOTM3NSBDNDcuMjg5MTQwNjMgMTcuMjkzMjgxMjUgNDYuMzc5MDYyNSAxNy42NDkwNjI1IDQ1LjQ0MTQwNjI1IDE4LjAxNTYyNSBDMzUuNzQxNTkwMzQgMjAuNzczNjQ0OTQgMjUuMDE5Mzc3NDIgMTkuODU3MjIxMjEgMTUuOTkyMTg3NSAxNS41MTE3MTg3NSBDMTIuMDQ4ODgzNTkgMTMuMjg5MTI5MjggOC4yMjc0ODUxNSAxMC45MjQyODc4OCA0LjQ3NjU2MjUgOC4zOTA2MjUgQzIuMTgyMDUzMzkgNi43OTYzNzg4IDIuMTgyMDUzMzkgNi43OTYzNzg4IC0wLjgwMDc4MTI1IDUuOTM3NSBaICIgZmlsbD0iI0Y5RURFRCIgdHJhbnNmb3JtPSJ0cmFuc2xhdGUoNDAuODAwNzgxMjUsMzIuMDYyNSkiLz4KPHBhdGggZD0iTTAgMCBDMC41ODEzNjcxOSAwLjIzMDc0MjE5IDEuMTYyNzM0MzcgMC40NjE0ODQzNyAxLjc2MTcxODc1IDAuNjk5MjE4NzUgQzAuNjc4OTA2MjUgMS41MDM1OTM3NSAwLjY3ODkwNjI1IDEuNTAzNTkzNzUgLTAuNDI1NzgxMjUgMi4zMjQyMTg3NSBDLTMuNDg2MTIzMjUgNC45MDg1MDc1NSAtNS43NTA0ODEzNiA3LjU3MTY5ODg5IC04LjIzODI4MTI1IDEwLjY5OTIxODc1IEMtOC45Mzc1IDguOTM3NSAtOC45Mzc1IDguOTM3NSAtOS4yMzgyODEyNSA2LjY5OTIxODc1IEMtNy45NDUzMTI1IDQuNzQyMTg3NSAtNy45NDUzMTI1IDQuNzQyMTg3NSAtNi4wNTA3ODEyNSAyLjg4NjcxODc1IEMtNS40Mzg0NzY1NiAyLjI2MTUyMzQ0IC00LjgyNjE3MTg4IDEuNjM2MzI4MTIgLTQuMTk1MzEyNSAwLjk5MjE4NzUgQy0yLjIzODI4MTI1IC0wLjMwMDc4MTI1IC0yLjIzODI4MTI1IC0wLjMwMDc4MTI1IDAgMCBaICIgZmlsbD0iI0Y1REFERSIgdHJhbnNmb3JtPSJ0cmFuc2xhdGUoNDEuMjM4MjgxMjUsMzIuMzAwNzgxMjUpIi8+CjxwYXRoIGQ9Ik0wIDAgQzIuMzEgMCA0LjYyIDAgNyAwIEM2LjAyNDMzODg4IDEuMTY5NTk5ODcgNS4wNDQzNzUgMi4zMzU2MTE3NyA0LjA2MjUgMy41IEMzLjUxNzIyNjU2IDQuMTQ5Njg3NSAyLjk3MTk1MzEyIDQuNzk5Mzc1IDIuNDEwMTU2MjUgNS40Njg3NSBDMS45NDQ4MDQ2OSA1Ljk3NDA2MjUgMS40Nzk0NTMxMyA2LjQ3OTM3NSAxIDcgQzAuNjcgNyAwLjM0IDcgMCA3IEMwIDQuNjkgMCAyLjM4IDAgMCBaICIgZmlsbD0iIzFDMUIyMyIgdHJhbnNmb3JtPSJ0cmFuc2xhdGUoMCwwKSIvPgo8cGF0aCBkPSJNMCAwIEMyLjMxIDAgNC42MiAwIDcgMCBDNyAxLjk4IDcgMy45NiA3IDYgQzUuODMwNTQyMDggNS4xOTE1MjI3MSA0LjY2NDQ5NTM5IDQuMzc4MTA4ODggMy41IDMuNTYyNSBDMi44NTAzMTI1IDMuMTEwMDM5MDYgMi4yMDA2MjUgMi42NTc1NzgxMiAxLjUzMTI1IDIuMTkxNDA2MjUgQzEuMDI1OTM3NSAxLjc5ODI0MjE5IDAuNTIwNjI1IDEuNDA1MDc4MTIgMCAxIEMwIDAuNjcgMCAwLjM0IDAgMCBaICIgZmlsbD0iIzI2MjEyMSIgdHJhbnNmb3JtPSJ0cmFuc2xhdGUoMTQzLDApIi8+CjxwYXRoIGQ9Ik0wIDAgQzAuNjYgMC4zMyAxLjMyIDAuNjYgMiAxIEMtMC42NCAzLjY0IC0zLjI4IDYuMjggLTYgOSBDLTYgNiAtNiA2IC0zLjU2MjUgMy4zNzUgQy0yLjcxNjg3NSAyLjU5MTI1IC0xLjg3MTI1IDEuODA3NSAtMSAxIEMtMC42NyAwLjY3IC0wLjM0IDAuMzQgMCAwIFogIiBmaWxsPSIjQkYzNTUzIiB0cmFuc2Zvcm09InRyYW5zbGF0ZSg3LDApIi8+Cjwvc3ZnPgo=';
  readonly url = 'https://crossmark.io';

  private currentAccount: AccountInfo | null = null;

  constructor(_options: CrossmarkAdapterOptions = {}) {
    // Options not currently used
  }

  /**
   * Check if Crossmark is installed
   */
  async isAvailable(): Promise<boolean> {
    try {
      if (!sdk.sync.isInstalled()) {
        return false;
      }
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Connect to Crossmark wallet
   */
  async connect(options?: ConnectOptions): Promise<AccountInfo> {
    try {
      // Check if Crossmark is available
      const available = await this.isAvailable();
      if (!available) {
        throw createWalletError.notInstalled(this.name);
      }

      // Determine network
      const network = this.resolveNetwork(options?.network);

      // Generate a random hash for signing
      const hash = this.generateRandomHash();

      // Request sign-in from Crossmark
      const signInResponse = await sdk.methods.signInAndWait(hash);

      if (!signInResponse || !signInResponse.response || !signInResponse.response.data) {
        throw new Error('Failed to sign in with Crossmark');
      }

      const { address, publicKey } = signInResponse.response.data;

      if (!address) {
        throw new Error('No address returned from Crossmark');
      }

      this.currentAccount = {
        address,
        publicKey,
        network,
      };

      return this.currentAccount;
    } catch (error) {
      throw createWalletError.connectionFailed(this.name, error as Error);
    }
  }

  /**
   * Disconnect from Crossmark
   */
  async disconnect(): Promise<void> {
    this.currentAccount = null;
  }

  /**
   * Get current account
   */
  async getAccount(): Promise<AccountInfo | null> {
    return this.currentAccount;
  }

  /**
   * Get current network
   */
  async getNetwork(): Promise<NetworkInfo> {
    if (!this.currentAccount) {
      throw createWalletError.notConnected();
    }
    return this.currentAccount.network;
  }

  /**
   * Sign and optionally submit a transaction
   * @param transaction - The transaction to sign
   * @param submit - Whether to submit to the ledger (default: true)
   */
  async signAndSubmit(transaction: Transaction): Promise<SubmittedTransaction> {
    if (!this.currentAccount) {
      throw createWalletError.notConnected();
    }

    try {
      const tx = {
        ...transaction,
        Account: transaction.Account || this.currentAccount.address,
      };
      const signResponse = await sdk.methods.signAndSubmitAndWait(tx as any);

      if (!signResponse.response.data.resp.result.hash) {
        throw new Error('Failed to sign transaction with Crossmark');
      }
      return {
        hash: signResponse.response.data.resp.result.hash,
      };
    } catch (error) {
      if (error instanceof Error && error.message.toLowerCase().includes('reject')) {
        throw createWalletError.signRejected();
      }
      throw createWalletError.signFailed(error as Error);
    }
  }

  /**
   * Sign a message
   */
  async signMessage(message: string | Uint8Array): Promise<SignedMessage> {
    if (!this.currentAccount) {
      throw createWalletError.notConnected();
    }

    try {
      const messageStr = typeof message === 'string' ? message : new TextDecoder().decode(message);

      // Crossmark doesn't have a dedicated signMessage method
      // We can use signInAndWait with the message as the hash
      const signResponse = await sdk.methods.signInAndWait(messageStr);

      if (!signResponse || !signResponse.response || !signResponse.response.data) {
        throw new Error('Failed to sign message with Crossmark');
      }

      const { signature, publicKey } = signResponse.response.data;

      return {
        message: messageStr,
        signature: signature || '',
        publicKey: publicKey || this.currentAccount.publicKey || '',
      };
    } catch (error) {
      throw createWalletError.signFailed(error as Error);
    }
  }

  /**
   * Resolve network configuration
   */
  private resolveNetwork(config?: ConnectOptions['network']): NetworkInfo {
    if (!config) {
      return STANDARD_NETWORKS.mainnet;
    }

    if (typeof config === 'string') {
      const network = STANDARD_NETWORKS[config];
      if (!network) {
        throw createWalletError.unknown(`Unknown network: ${config}`);
      }
      return network;
    }

    return config;
  }

  /**
   * Generate a random hash for signing
   */
  private generateRandomHash(): string {
    const array = new Uint8Array(32);
    if (typeof window !== 'undefined' && window.crypto) {
      window.crypto.getRandomValues(array);
    } else {
      // Fallback for environments without crypto
      for (let i = 0; i < array.length; i++) {
        array[i] = Math.floor(Math.random() * 256);
      }
    }
    return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
  }
}
