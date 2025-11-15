/**
 * Xaman (formerly Xumm) Wallet Adapter
 */

import { Xumm } from 'xumm';
import {
  WalletAdapter,
  AccountInfo,
  ConnectOptions,
  NetworkInfo,
  Transaction,
  SignedMessage,
  SubmittedTransaction,
  STANDARD_NETWORKS,
} from '@xrpl-connect/core';
import { createWalletError, createLogger } from '@xrpl-connect/core';

/**
 * Logger instance for Xaman adapter
 */
const logger = createLogger('[Xaman]');

/**
 * Xaman adapter options
 */
export interface XamanAdapterOptions {
  apiKey?: string; // Xumm API key (can also be provided in connect options)
  onQRCode?: (uri: string) => void; // Callback for QR code URI
  onDeepLink?: (uri: string) => string; // Transform URI for deep linking
  returnUrl?: string; // URL to return to after signing on mobile (appends ?payloadId=xxx). If not provided, keeps listening in background
}

/**
 * Xaman wallet adapter implementation
 */
export class XamanAdapter implements WalletAdapter {
  readonly id = 'xaman';
  readonly name = 'Xaman';
  readonly icon =
    'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjU2IiBoZWlnaHQ9IjI1NiIgdmlld0JveD0iMCAwIDI1NiAyNTYiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxnIGNsaXAtcGF0aD0idXJsKCNjbGlwMF8zMTE2Xzk1OCkiPgo8cGF0aCBkPSJNMjU2IDBIMFYyNTZIMjU2VjBaIiBmaWxsPSIjMDAzMENGIi8+CjxwYXRoIGZpbGwtcnVsZT0iZXZlbm9kZCIgY2xpcC1ydWxlPSJldmVub2RkIiBkPSJNMTUyLjc4MiAtMjM3LjMzOEMyMDguMyAtMjE3LjMyMyAyNjIuMTgzIC0xNzIuNjk0IDI5My45MTQgLTEzNi4zNTlDMzI1LjczIC05OS45MjM4IDM0OC4yMTMgLTU3LjAyMDEgMzUzLjI2MSAtNy41MjA3NEMzNTguMzEgNDEuOTkwOSAzNDUuODg1IDk3LjgwNTEgMzA4LjQwMyAxNTkuOTkzQzI3MS4wMDMgMjIyLjA0NiAxOTMuNjYyIDMxNS4zMDYgMTE3Ljc2OSAzODQuMDM3Qzc5LjgzNDQgNDE4LjM5IDQyLjA4NzkgNDQ2Ljc3NyA5LjczNjk0IDQ2Mi4wMzZDLTYuNDMyNzggNDY5LjY2MyAtMjEuNDU1MSA0NzQuMTA3IC0zNC41OTU4IDQ3NC4yNDFDLTQ3LjgzOCA0NzQuMzc3IC01OS4yMTg5IDQ3MC4xMjIgLTY3LjcyMDQgNDYwLjM4NkMtNzYuMDY2NiA0NTAuODI5IC04Mi4xODggNDM1LjMzMSAtODYuNTM0MyA0MTUuNzE3Qy05MC44OTg4IDM5Ni4wMjEgLTkzLjU0NTMgMzcxLjgyNyAtOTQuNzA0NiAzNDQuNTU3Qy05Ny4wMjM0IDI5MC4wMDggLTkzLjQwMjIgMjIyLjg2MSAtODUuNDg1OCAxNTQuMTc0Qy03Ny41Njg0IDg1LjQ3NzMgLTY1LjM0NTMgMTUuMTU5NiAtNTAuNDMxNSAtNDUuNzQzMUMtMzUuNTM2MiAtMTA2LjU3IC0xNy44OTc0IC0xNTguMjYgMC45NDc1NDggLTE4OS41MjdDMTkuODk1MyAtMjIwLjk2NCA0My44NjY3IC0yMzguMDgyIDcwLjI2OTYgLTI0NC42OTNDOTYuNTg3MiAtMjUxLjI4MyAxMjQuOTk3IC0yNDcuMzU1IDE1Mi43ODIgLTIzNy4zMzhaTTcxLjYwNTUgLTIzOS4zNThDNDYuNzgwMiAtMjMzLjE0MiAyMy45NDg5IC0yMTcuMDM1IDUuNjU4MDkgLTE4Ni42ODhDLTEyLjczNTUgLTE1Ni4xNyAtMzAuMjE5IC0xMDUuMTYgLTQ1LjA4OTMgLTQ0LjQzNUMtNTkuOTQxMiAxNi4yMTUxIC03Mi4xMjcyIDg2LjMwMzQgLTgwLjAyMiAxNTQuODA0Qy04Ny45MTc5IDIyMy4zMTMgLTkxLjUxMjIgMjkwLjE1NSAtODkuMjA5NSAzNDQuMzIzQy04OC4wNTggMzcxLjQxMSAtODUuNDM0NSAzOTUuMjU4IC04MS4xNjQ2IDQxNC41MjdDLTc2Ljg3NjYgNDMzLjg3OCAtNzAuOTk5NCA0NDguMjcgLTYzLjU3NzcgNDU2Ljc2OUMtNTYuMzExMSA0NjUuMDkgLTQ2LjU3NzkgNDY4Ljg2MyAtMzQuNjUxOSA0NjguNzQyQy0yMi42MjQzIDQ2OC42MTkgLTguNDI0MTkgNDY0LjUyMSA3LjM5MDY3IDQ1Ny4wNjFDMzkuMDA4OSA0NDIuMTQ4IDc2LjI4MDEgNDE0LjE4OSAxMTQuMDc3IDM3OS45NkMxODkuNjQ0IDMxMS41MjQgMjY2LjYxNiAyMTguNjcgMzAzLjY5MiAxNTcuMTU0QzM0MC42ODggOTUuNzczNiAzNTIuNjk1IDQxLjEzODkgMzQ3Ljc4OSAtNi45NjI3NUMzNDIuODgzIC01NS4wNzY3IDMyMS4wMjUgLTk2Ljk1MDUgMjg5Ljc3MSAtMTMyLjc0MUMyNTguNDI5IC0xNjguNjMxIDIwNS4yODEgLTIxMi41NjQgMTUwLjkxNyAtMjMyLjE2NEMxMjMuNzYgLTI0MS45NTQgOTYuNTE2MSAtMjQ1LjU5NiA3MS42MDU1IC0yMzkuMzU4WiIgZmlsbD0idXJsKCNwYWludDBfbGluZWFyXzMxMTZfOTU4KSIvPgo8cGF0aCBmaWxsLXJ1bGU9ImV2ZW5vZGQiIGNsaXAtcnVsZT0iZXZlbm9kZCIgZD0iTTE1MC4zOTcgLTIwMS4wNjNDMjAwLjQyMSAtMTgzLjAyOCAyNDguOTUyIC0xNDIuODI4IDI3Ny41MjkgLTExMC4xMDRDMzA2LjE5MyAtNzcuMjggMzI2LjQ1OSAtMzguNjE1MiAzMzEuMDA5IDYuMDAzNDZDMzM1LjU2IDUwLjYzNDQgMzI0LjM1NiAxMDAuOTI2IDI5MC41OTggMTU2LjkzNkMyNTYuOTIyIDIxMi44MSAxODcuMjk3IDI5Ni43NjQgMTE4Ljk3NiAzNTguNjM3Qzg0LjgyODggMzg5LjU2MSA1MC44MzMyIDQxNS4xMzEgMjEuNjgwNyA0MjguODgxQzcuMTEwMjEgNDM1Ljc1NCAtNi40NTA5NiA0MzkuNzcxIC0xOC4zMzMyIDQzOS44OTJDLTMwLjMxNzEgNDQwLjAxNSAtNDAuNjQyMyA0MzYuMTYxIC00OC4zNTUzIDQyNy4zMjlDLTU1LjkxMzIgNDE4LjY3NCAtNjEuNDM0NyA0MDQuNjcxIC02NS4zNDkzIDM4Ny4wMDVDLTY5LjI4MiAzNjkuMjU3IC03MS42NjUxIDM0Ny40NjUgLTcyLjcwODggMzIyLjkxM0MtNzQuNzk2NiAyNzMuOCAtNzEuNTM2MiAyMTMuMzUzIC02NC40MTA0IDE1MS41MjVDLTU3LjI4MzUgODkuNjg4NCAtNDYuMjgwOCAyNi4zOTEgLTMyLjg1NTMgLTI4LjQzNDFDLTE5LjQ0ODMgLTgzLjE4MzkgLTMuNTY1NjQgLTEyOS43MzkgMTMuNDE3NCAtMTU3LjkxNkMzMC41MDMyIC0xODYuMjY0IDUyLjEzNDQgLTIwMS43MjEgNzUuOTc1OSAtMjA3LjY5MUM5OS43MzIxIC0yMTMuNjM5IDEyNS4zNTkgLTIxMC4wODkgMTUwLjM5NyAtMjAxLjA2M1pNNzcuMzExOSAtMjAyLjM1NUM1NS4wNDc5IC0xOTYuNzgxIDM0LjU1NjggLTE4Mi4zMzUgMTguMTI3OSAtMTU1LjA3N0MxLjU5NjI2IC0xMjcuNjQ4IC0xNC4xMzExIC04MS43NzM3IC0yNy41MTMyIC0yNy4xMjZDLTQwLjg3NjggMjcuNDQ2NSAtNTEuODQyMyA5MC41MTQ1IC01OC45NDY1IDE1Mi4xNTVDLTY2LjA1MTggMjEzLjgwNSAtNjkuMjg1NCAyNzMuOTQ3IC02Ny4yMTM3IDMyMi42NzlDLTY2LjE3NzggMzQ3LjA1IC02My44MTc3IDM2OC40OTQgLTU5Ljk3OTYgMzg1LjgxNUMtNTYuMTIzMiA0MDMuMjE4IC01MC44NDYgNDE2LjExNSAtNDQuMjEyNiA0MjMuNzExQy0zNy43MzQ1IDQzMS4xMjkgLTI5LjA1NyA0MzQuNTAyIC0xOC4zODk0IDQzNC4zOTNDLTcuNjIwMjEgNDM0LjI4MyA1LjExODc5IDQzMC42MTIgMTkuMzM0NCA0MjMuOTA3QzQ3Ljc1NDIgNDEwLjUwMiA4MS4yNzQ1IDM4NS4zNiAxMTUuMjg0IDM1NC41NkMxODMuMjc5IDI5Mi45ODIgMjUyLjUzNSAyMDkuNDM0IDI4NS44ODcgMTU0LjA5NkMzMTkuMTU5IDk4Ljg5NDYgMzI5Ljk0NSA0OS43ODI0IDMyNS41MzcgNi41NjE0M0MzMjEuMTI5IC0zNi42NzE4IDMwMS40ODcgLTc0LjMwNjcgMjczLjM4NiAtMTA2LjQ4NkMyNDUuMTk4IC0xMzguNzY0IDE5Ny40MDIgLTE3OC4yNyAxNDguNTMyIC0xOTUuODg5QzEyNC4xMjMgLTIwNC42ODkgOTkuNjYxMSAtMjA3Ljk1MiA3Ny4zMTE5IC0yMDIuMzU1WiIgZmlsbD0idXJsKCNwYWludDFfbGluZWFyXzMxMTZfOTU4KSIvPgo8cGF0aCBmaWxsLXJ1bGU9ImV2ZW5vZGQiIGNsaXAtcnVsZT0iZXZlbm9kZCIgZD0iTTE0OC4wMTIgLTE2NC43ODhDMTkyLjU0MSAtMTQ4LjczNCAyMzUuNzIxIC0xMTIuOTYxIDI2MS4xNDQgLTgzLjg0ODZDMjg2LjY1NCAtNTQuNjM2NCAzMDQuNzAzIC0yMC4yMTA1IDMwOC43NTYgMTkuNTI3NUMzMTIuODEgNTkuMjc3OCAzMDIuODI3IDEwNC4wNDcgMjcyLjc5MyAxNTMuODc4QzI0Mi44NDEgMjAzLjU3NCAxODAuOTMxIDI3OC4yMjMgMTIwLjE4NCAzMzMuMjM3Qzg5LjgyMjkgMzYwLjczMiA1OS41NzgxIDM4My40ODUgMzMuNjI0MSAzOTUuNzI2QzIwLjY1MjkgNDAxLjg0NSA4LjU1MjgxIDQwNS40MzUgLTIuMDcxMDQgNDA1LjU0NEMtMTIuNzk2NSA0MDUuNjUzIC0yMi4wNjYgNDAyLjIwMSAtMjguOTkwNiAzOTQuMjcxQy0zNS43NiAzODYuNTIgLTQwLjY4MTYgMzc0LjAxMSAtNDQuMTY0NSAzNTguMjkzQy00Ny42NjU2IDM0Mi40OTQgLTQ5Ljc4NTEgMzIzLjEwNCAtNTAuNzEzMyAzMDEuMjY5Qy01Mi41NyAyNTcuNTkyIC00OS42NzAzIDIwMy44NDQgLTQzLjMzNTIgMTQ4Ljg3NkMtMzYuOTk4OSA5My44OTk0IC0yNy4yMTY3IDM3LjYyMjMgLTE1LjI3OTUgLTExLjEyNTJDLTMuMzYwNzIgLTU5Ljc5NzQgMTAuNzY1OCAtMTAxLjIxNyAyNS44ODcgLTEyNi4zMDVDNDEuMTEwOCAtMTUxLjU2NCA2MC40MDIgLTE2NS4zNiA4MS42ODIgLTE3MC42ODhDMTAyLjg3NyAtMTc1Ljk5NSAxMjUuNzIxIC0xNzIuODI0IDE0OC4wMTIgLTE2NC43ODhaTTgzLjAxOCAtMTY1LjM1M0M2My4zMTU1IC0xNjAuNDE5IDQ1LjE2NDUgLTE0Ny42MzUgMzAuNTk3NSAtMTIzLjQ2NkMxNS45Mjc3IC05OS4xMjcgMS45NTY0NyAtNTguMzg3MiAtOS45MzczMiAtOS44MTcwNEMtMjEuODEyNyAzOC42Nzc3IC0zMS41NTc3IDk0LjcyNTUgLTM3Ljg3MTMgMTQ5LjUwNkMtNDQuMTg2IDIwNC4yOTYgLTQ3LjA1ODggMjU3LjczOSAtNDUuMjE4MiAzMDEuMDM2Qy00NC4yOTc4IDMyMi42ODggLTQyLjIwMTIgMzQxLjczMSAtMzguNzk0OCAzNTcuMTAzQy0zNS4zNzAyIDM3Mi41NTggLTMwLjY5MjkgMzgzLjk2MSAtMjQuODQ3OSAzOTAuNjU0Qy0xOS4xNTgyIDM5Ny4xNjkgLTExLjUzNjQgNDAwLjE0IC0yLjEyNzIyIDQwMC4wNDRDNy4zODM1NCAzOTkuOTQ3IDE4LjY2MTQgMzk2LjcwMyAzMS4yNzc4IDM5MC43NTJDNTYuNDk5MSAzNzguODU2IDg2LjI2ODYgMzU2LjUzMSAxMTYuNDkyIDMyOS4xNkMxNzYuOTE0IDI3NC40NDEgMjM4LjQ1NCAyMDAuMTk4IDI2OC4wODIgMTUxLjAzOUMyOTcuNjMgMTAyLjAxNiAzMDcuMTk0IDU4LjQyNTggMzAzLjI4NCAyMC4wODU1QzI5OS4zNzMgLTE4LjI2NyAyODEuOTQ5IC01MS42NjMgMjU3LjAwMSAtODAuMjMwOUMyMzEuOTY3IC0xMDguODk4IDE4OS41MjMgLTE0My45NzYgMTQ2LjE0NiAtMTU5LjYxNEMxMjQuNDg0IC0xNjcuNDIzIDEwMi44MDYgLTE3MC4zMDggODMuMDE4IC0xNjUuMzUzWiIgZmlsbD0idXJsKCNwYWludDJfbGluZWFyXzMxMTZfOTU4KSIvPgo8cGF0aCBmaWxsLXJ1bGU9ImV2ZW5vZGQiIGNsaXAtcnVsZT0iZXZlbm9kZCIgZD0iTTE0NS42MjcgLTEyOC41MTNDMTg0LjY2MiAtMTE0LjQ0IDIyMi40OTEgLTgzLjA5NTIgMjQ0Ljc2IC01Ny41OTM2QzI2Ny4xMTcgLTMxLjk5MjcgMjgyLjk0OSAtMS44MDU2MyAyODYuNTA0IDMzLjA1MTdDMjkwLjA2IDY3LjkyMTIgMjgxLjMgMTA3LjE2OCAyNTQuOTkgMTUwLjgyMUMyMjguNzYxIDE5NC4zMzggMTc0LjU2NiAyNTkuNjgxIDEyMS4zOTIgMzA3LjgzN0M5NC44MTc0IDMzMS45MDQgNjguMzIzNCAzNTEuODM5IDQ1LjU2NzkgMzYyLjU3MkMzNC4xOTU4IDM2Ny45MzYgMjMuNTU2OSAzNzEuMDk5IDE0LjE5MTQgMzcxLjE5NUM0LjcyNDQxIDM3MS4yOTEgLTMuNDg5MzggMzY4LjI0MSAtOS42MjU2NCAzNjEuMjE0Qy0xNS42MDY3IDM1NC4zNjUgLTE5LjkyODMgMzQzLjM1IC0yMi45Nzk1IDMyOS41ODFDLTI2LjA0ODggMzE1LjczIC0yNy45MDQ4IDI5OC43NDIgLTI4LjcxNzUgMjc5LjYyNUMtMzAuMzQzMSAyNDEuMzg0IC0yNy44MDQzIDE5NC4zMzYgLTIyLjI1OTcgMTQ2LjIyOEMtMTYuNzE0MSA5OC4xMTA1IC04LjE1MjM2IDQ4Ljg1MzYgMi4yOTY1NyA2LjE4Mzc1QzEyLjcyNyAtMzYuNDEwOCAyNS4wOTc1IC03Mi42OTU3IDM4LjM1NjYgLTk0LjY5NDZDNTEuNzE4NiAtMTE2Ljg2NCA2OC42Njk2IC0xMjguOTk4IDg3LjM4ODIgLTEzMy42ODZDMTA2LjAyMiAtMTM4LjM1MiAxMjYuMDgzIC0xMzUuNTU4IDE0NS42MjcgLTEyOC41MTNaTTg4LjcyNDIgLTEyOC4zNUM3MS41ODMxIC0xMjQuMDU4IDU1Ljc3MjIgLTExMi45MzUgNDMuMDY3MiAtOTEuODU1NEMzMC4yNTk0IC03MC42MDU0IDE4LjA0NDIgLTM1LjAwMDYgNy42Mzg3MyA3LjQ5MTkzQy0yLjc0ODMxIDQ5LjkwOTEgLTExLjI3MjkgOTguOTM2NiAtMTYuNzk1OSAxNDYuODU3Qy0yMi4zMTk5IDE5NC43ODggLTI0LjgzMTkgMjQxLjUzMSAtMjMuMjIyNCAyNzkuMzkyQy0yMi40MTc1IDI5OC4zMjYgLTIwLjU4NDUgMzE0Ljk2NyAtMTcuNjA5OCAzMjguMzkxQy0xNC42MTY5IDM0MS44OTcgLTEwLjUzOTUgMzUxLjgwNiAtNS40ODI5MiAzNTcuNTk2Qy0wLjU4MTU4MSAzNjMuMjA5IDUuOTg0NTIgMzY1Ljc3OCAxNC4xMzUzIDM2NS42OTVDMjIuMzg3NiAzNjUuNjExIDMyLjIwNDQgMzYyLjc5NCA0My4yMjE2IDM1Ny41OTdDNjUuMjQ0NCAzNDcuMjEgOTEuMjYzMSAzMjcuNzAyIDExNy43IDMwMy43NkMxNzAuNTQ5IDI1NS45IDIyNC4zNzQgMTkwLjk2MiAyNTAuMjggMTQ3Ljk4MkMyNzYuMTAyIDEwNS4xMzcgMjg0LjQ0NSA2Ny4wNjkzIDI4MS4wMzIgMzMuNjA5N0MyNzcuNjE5IDAuMTM3Nzg3IDI2Mi40MTIgLTI5LjAxOTMgMjQwLjYxOCAtNTMuOTc1OUMyMTguNzM3IC03OS4wMzE4IDE4MS42NDQgLTEwOS42ODEgMTQzLjc2MiAtMTIzLjMzOUMxMjQuODQ3IC0xMzAuMTU4IDEwNS45NTEgLTEzMi42NjQgODguNzI0MiAtMTI4LjM1WiIgZmlsbD0idXJsKCNwYWludDNfbGluZWFyXzMxMTZfOTU4KSIvPgo8cGF0aCBmaWxsLXJ1bGU9ImV2ZW5vZGQiIGNsaXAtcnVsZT0iZXZlbm9kZCIgZD0iTTE0My4yNDIgLTkyLjIzNzVDMTc2Ljc4MyAtODAuMTQ1MiAyMDkuMjYgLTUzLjIyOSAyMjguMzc2IC0zMS4zMzg3QzI0Ny41NzkgLTkuMzQ4OTIgMjYxLjE5NCAxNi41OTkzIDI2NC4yNTEgNDYuNTc2QzI2Ny4zMDkgNzYuNTY0OSAyNTkuNzcxIDExMC4yODkgMjM3LjE4NCAxNDcuNzY0QzIxNC42NzkgMTg1LjEwMyAxNjguMjAxIDI0MS4xNCAxMjIuNiAyODIuNDM4Qzk5LjgxMTUgMzAzLjA3NSA3Ny4wNjg1IDMyMC4xOTMgNTcuNTExNSAzMjkuNDE3QzQ3LjczODcgMzM0LjAyNyAzOC41NjA5IDMzNi43NjMgMzAuNDUzOSAzMzYuODQ2QzIyLjI0NTIgMzM2LjkyOSAxNS4wODcyIDMzNC4yOCA5LjczOTM0IDMyOC4xNTZDNC41NDY3MiAzMjIuMjEgMC44MjQ5NzYgMzEyLjY5IC0xLjc5NDQ4IDMwMC44NjlDLTQuNDMyMDcgMjg4Ljk2NiAtNi4wMjQ1OSAyNzQuMzggLTYuNzIxNyAyNTcuOTgyQy04LjExNjI1IDIyNS4xNzYgLTUuOTM4MTggMTg0LjgyNyAtMS4xODQyNCAxNDMuNTc5QzMuNTcwNzYgMTAyLjMyMiAxMC45MTIxIDYwLjA4NSAxOS44NzI3IDIzLjQ5MjdDMjguODE0OSAtMTMuMDI0MiAzOS40MjkyIC00NC4xNzQyIDUwLjgyNjUgLTYzLjA4MzlDNjIuMzI2NSAtODIuMTY0IDc2LjkzNzMgLTkyLjYzNzIgOTMuMDk0NiAtOTYuNjgzQzEwOS4xNjcgLTEwMC43MDcgMTI2LjQ0NSAtOTguMjkzIDE0My4yNDIgLTkyLjIzNzVaTTk0LjQzMDUgLTkxLjM0NzhDNzkuODUwOCAtODcuNjk3IDY2LjM4MDEgLTc4LjIzNSA1NS41MzcgLTYwLjI0NDdDNDQuNTkxMSAtNDIuMDgzOSAzNC4xMzIxIC0xMS42MTQxIDI1LjIxNDkgMjQuODAwOUMxNi4zMTYxIDYxLjE0MDQgOS4wMTE5NiAxMDMuMTQ4IDQuMjc5NTkgMTQ0LjIwOUMtMC40NTM4NTIgMTg1LjI3OSAtMi42MDUwNiAyMjUuMzIzIC0xLjIyNjY2IDI1Ny43NDhDLTAuNTM3Mjg2IDI3My45NjUgMS4wMzIyMyAyODguMjAzIDMuNTc1MjYgMjk5LjY3OUM2LjEzNjQzIDMxMS4yMzcgOS42MTM4OSAzMTkuNjUxIDEzLjg4MjEgMzI0LjUzOUMxNy45OTUgMzI5LjI0OCAyMy41MDU0IDMzMS40MTYgMzAuMzk3NyAzMzEuMzQ2QzM3LjM5MTYgMzMxLjI3NCA0NS43NDcyIDMyOC44ODUgNTUuMTY1MiAzMjQuNDQzQzczLjk4OTUgMzE1LjU2NCA5Ni4yNTcyIDI5OC44NzQgMTE4LjkwOCAyNzguMzYxQzE2NC4xODMgMjM3LjM1OCAyMTAuMjkyIDE4MS43MjYgMjMyLjQ3NCAxNDQuOTI0QzI1NC41NzMgMTA4LjI1OCAyNjEuNjk0IDc1LjcxMjkgMjU4Ljc3OSA0Ny4xMzRDMjU1Ljg2NCAxOC41NDI3IDI0Mi44NzQgLTYuMzc1NTggMjI0LjIzNCAtMjcuNzIwOUMyMDUuNTA3IC00OS4xNjU2IDE3My43NjUgLTc1LjM4NyAxNDEuMzc3IC04Ny4wNjM0QzEyNS4yMDkgLTkyLjg5MjMgMTA5LjA5NiAtOTUuMDE5OSA5NC40MzA1IC05MS4zNDc4WiIgZmlsbD0idXJsKCNwYWludDRfbGluZWFyXzMxMTZfOTU4KSIvPgo8cGF0aCBmaWxsLXJ1bGU9ImV2ZW5vZGQiIGNsaXAtcnVsZT0iZXZlbm9kZCIgZD0iTTE0MC44NTcgLTU1Ljk2MjVDMTY4LjkwNCAtNDUuODUxIDE5Ni4wMjkgLTIzLjM2MjkgMjExLjk5MiAtNS4wODM3M0MyMjguMDQxIDEzLjI5NDggMjM5LjQzOSAzNS4wMDQxIDI0MS45OTkgNjAuMTAwMUMyNDQuNTU5IDg1LjIwODQgMjM4LjI0MiAxMTMuNDEgMjE5LjM4IDE0NC43MDZDMjAwLjU5OCAxNzUuODY3IDE2MS44MzUgMjIyLjU5OSAxMjMuODA3IDI1Ny4wMzhDMTA0LjgwNiAyNzQuMjQ2IDg1LjgxMzggMjg4LjU0NyA2OS40NTUxIDI5Ni4yNjNDNjEuMjgxNiAzMDAuMTE4IDUzLjU2NDkgMzAyLjQyNyA0Ni43MTYzIDMwMi40OTdDMzkuNzY2MSAzMDIuNTY4IDMzLjY2MzggMzAwLjMyIDI5LjEwNDQgMjk1LjA5OUMyNC43MDAxIDI5MC4wNTYgMjEuNTc4MyAyODIuMDMgMTkuMzkwNiAyNzIuMTU3QzE3LjE4NDcgMjYyLjIwMiAxNS44NTU3IDI1MC4wMTggMTUuMjc0MSAyMzYuMzM4QzE0LjExMDYgMjA4Ljk2OCAxNS45Mjc5IDE3NS4zMTkgMTkuODkxMiAxNDAuOTNDMjMuODU1NiAxMDYuNTMzIDI5Ljk3NjQgNzEuMzE2MyAzNy40NDg4IDQwLjgwMTZDNDQuOTAyNyAxMC4zNjI0IDUzLjc2MDkgLTE1LjY1MjYgNjMuMjk2MiAtMzEuNDczMUM3Mi45MzQyIC00Ny40NjQxIDg1LjIwNSAtNTYuMjc2MSA5OC44MDA4IC01OS42ODA1QzExMi4zMTEgLTYzLjA2MzYgMTI2LjgwOCAtNjEuMDI3NyAxNDAuODU3IC01NS45NjI1Wk0xMDAuMTM3IC01NC4zNDUzQzg4LjExODUgLTUxLjMzNTggNzYuOTg3OSAtNDMuNTM1MSA2OC4wMDY3IC0yOC42MzM5TDY1LjY1MTUgLTMwLjA1MzVMNjguMDA2NyAtMjguNjMzOUM1OC45MjI4IC0xMy41NjI0IDUwLjIxOTkgMTEuNzcyNSA0Mi43OTA5IDQyLjEwOThDMzUuMzgwNSA3Mi4zNzE4IDI5LjI5NjggMTA3LjM1OSAyNS4zNTUgMTQxLjU2QzIxLjQxMjIgMTc1Ljc3IDE5LjYyMTggMjA5LjExNSAyMC43NjkxIDIzNi4xMDRDMjEuMzQzIDI0OS42MDMgMjIuNjQ5IDI2MS40MzkgMjQuNzYwMyAyNzAuOTY3QzI2Ljg4OTggMjgwLjU3NyAyOS43NjczIDI4Ny40OTYgMzMuMjQ3MSAyOTEuNDgxTDMxLjE3NTcgMjkzLjI5TDMzLjI0NzEgMjkxLjQ4MUMzNi41NzE2IDI5NS4yODggNDEuMDI2MiAyOTcuMDU1IDQ2LjY2MDEgMjk2Ljk5N0M1Mi4zOTU2IDI5Ni45MzggNTkuMjkwMSAyOTQuOTc2IDY3LjEwODggMjkxLjI4OEM4Mi43MzQ3IDI4My45MTggMTAxLjI1MiAyNzAuMDQ1IDEyMC4xMTUgMjUyLjk2MUMxNTcuODE4IDIxOC44MTcgMTk2LjIxMSAxNzIuNDkxIDIxNC42NjkgMTQxLjg2N0MyMzMuMDQ1IDExMS4zNzkgMjM4Ljk0NCA4NC4zNTY0IDIzNi41MjcgNjAuNjU4MUMyMzQuMTA5IDM2Ljk0NzUgMjIzLjMzNiAxNi4yNjgxIDIwNy44NDkgLTEuNDY2MDJDMTkyLjI3NiAtMTkuMjk5NSAxNjUuODg2IC00MS4wOTI4IDEzOC45OTIgLTUwLjc4ODVDMTI1LjU3MSAtNTUuNjI3IDExMi4yNCAtNTcuMzc2IDEwMC4xMzcgLTU0LjM0NTNaIiBmaWxsPSJ1cmwoI3BhaW50NV9saW5lYXJfMzExNl85NTgpIi8+CjxwYXRoIGZpbGwtcnVsZT0iZXZlbm9kZCIgY2xpcC1ydWxlPSJldmVub2RkIiBkPSJNMTM4LjQ3MiAtMTkuNjg3NUMxNjEuMDI1IC0xMS41NTY3IDE4Mi43OTkgNi41MDMzOCAxOTUuNjA4IDIxLjE3MTJDMjA4LjUwNCAzNS45Mzg0IDIxNy42ODQgNTMuNDA4OSAyMTkuNzQ2IDczLjYyNDJDMjIxLjgwOSA5My44NTE4IDIxNi43MTMgMTE2LjUzMSAyMDEuNTc0IDE0MS42NDlDMTg2LjUxNyAxNjYuNjMxIDE1NS40NyAyMDQuMDU2IDEyNS4wMTUgMjMxLjYzN0MxMDkuOCAyNDUuNDE2IDk0LjU1ODggMjU2Ljg5OSA4MS4zOTg2IDI2My4xMDZDNzQuODI0MyAyNjYuMjA3IDY4LjU2ODcgMjY4LjA4OCA2Mi45Nzg1IDI2OC4xNDVDNTcuMjg2NyAyNjguMjAzIDUyLjI0MDEgMjY2LjM1NyA0OC40NjkgMjYyLjAzOUM0NC44NTMyIDI1Ny44OTggNDIuMzMxMyAyNTEuMzY3IDQwLjU3NTMgMjQzLjQ0M0MzOC44MDEyIDIzNS40MzcgMzcuNzM1NiAyMjUuNjU1IDM3LjI2OTYgMjE0LjY5MkMzNi4zMzcyIDE5Mi43NTkgMzcuNzkzNyAxNjUuODA5IDQwLjk2NjQgMTM4LjI4MUM0NC4xNDAyIDExMC43NDMgNDkuMDQwNiA4Mi41NDcyIDU1LjAyNDcgNTguMTEwM0M2MC45OTAzIDMzLjc0ODggNjguMDkyNCAxMi44Njg4IDc1Ljc2NTggMC4xMzc1MzNDODMuNTQyIC0xMi43NjQyIDkzLjQ3MjYgLTE5LjkxNSAxMDQuNTA3IC0yMi42NzhDMTE1LjQ1NiAtMjUuNDE5NyAxMjcuMTcgLTIzLjc2MjIgMTM4LjQ3MiAtMTkuNjg3NVpNMTA1Ljg0MyAtMTcuMzQyOEM5Ni4zODYxIC0xNC45NzQ3IDg3LjU5NTYgLTguODM1MjUgODAuNDc2NCAyLjk3NjY3TDc4LjEyMTEgMS41NTcxTDgwLjQ3NjQgMi45NzY2OEM3My4yNTQzIDE0Ljk1OTEgNjYuMzA3NSAzNS4xNTg5IDYwLjM2NjggNTkuNDE4NUM1NC40NDQ2IDgzLjYwMjcgNDkuNTgxNCAxMTEuNTY5IDQ2LjQzMDMgMTM4LjkxQzQzLjI3ODEgMTY2LjI2MSA0MS44NDg0IDE5Mi45MDUgNDIuNzY0NiAyMTQuNDU5QzQzLjIyMjkgMjI1LjIzOSA0NC4yNjU1IDIzNC42NzQgNDUuOTQ1MSAyNDIuMjUzQzQ3LjY0MjggMjQ5LjkxNSA0OS45MjA0IDI1NS4zMzkgNTIuNjExNyAyNTguNDIxQzU1LjE0NzkgMjYxLjMyNSA1OC41NDY5IDI2Mi42OSA2Mi45MjI0IDI2Mi42NDZDNjcuMzk5NSAyNjIuNiA3Mi44MzI5IDI2MS4wNjUgNzkuMDUyNCAyNTguMTMxQzkxLjQ3OTggMjUyLjI3IDEwNi4yNDYgMjQxLjIxNCAxMjEuMzIzIDIyNy41NkMxNTEuNDUzIDIwMC4yNzUgMTgyLjEzIDE2My4yNTUgMTk2Ljg2NCAxMzguODFDMjExLjUxNiAxMTQuNSAyMTYuMTkzIDkyLjk5OTggMjE0LjI3NCA3NC4xODIyQzIxMi4zNTQgNTUuMzUyMyAyMDMuNzk4IDM4LjkxMTggMTkxLjQ2NSAyNC43ODg5QzE3OS4wNDUgMTAuNTY2NyAxNTguMDA3IC02Ljc5ODQgMTM2LjYwNyAtMTQuNTEzNEMxMjUuOTMzIC0xOC4zNjE2IDExNS4zODUgLTE5LjczMjEgMTA1Ljg0MyAtMTcuMzQyOFoiIGZpbGw9InVybCgjcGFpbnQ2X2xpbmVhcl8zMTE2Xzk1OCkiLz4KPHBhdGggZmlsbC1ydWxlPSJldmVub2RkIiBjbGlwLXJ1bGU9ImV2ZW5vZGQiIGQ9Ik0xMzYuMDg3IDE2LjU4NzZDMTUzLjE0NiAyMi43Mzc3IDE2OS41NjggMzYuMzY5NSAxNzkuMjI0IDQ3LjQyNjFDMTg4Ljk2NiA1OC41ODIgMTk1LjkzIDcxLjgxMzYgMTk3LjQ5NCA4Ny4xNDgzQzE5OS4wNTkgMTAyLjQ5NSAxOTUuMTg1IDExOS42NTIgMTgzLjc3IDEzOC41OTJDMTcyLjQzNiAxNTcuMzk1IDE0OS4xMDUgMTg1LjUxNSAxMjYuMjIzIDIwNi4yMzhDMTE0Ljc5NCAyMTYuNTg3IDEwMy4zMDQgMjI1LjI1MyA5My4zNDIzIDIyOS45NTJDODguMzY3MiAyMzIuMjk4IDgzLjU3MjggMjMzLjc1MyA3OS4yNDEgMjMzLjc5N0M3NC44MDc3IDIzMy44NDIgNzAuODE2NyAyMzIuMzk4IDY3LjgzNDEgMjI4Ljk4Mkw2OS45MDU0IDIyNy4xNzNMNjcuODM0MSAyMjguOTgyQzY1LjAwNjYgMjI1Ljc0NCA2My4wODQ3IDIyMC43MDggNjEuNzYwNCAyMTQuNzMyQzYwLjQxNzkgMjA4LjY3MyA1OS42MTU5IDIwMS4yOTMgNTkuMjY1NCAxOTMuMDQ5QzU4LjU2NDEgMTc2LjU1MSA1OS42NTk4IDE1Ni4zIDYyLjA0MTkgMTM1LjYzMkM2NC40MjUxIDExNC45NTQgNjguMTA1IDkzLjc3ODQgNzIuNjAwOCA3NS40MTkxQzc3LjA3ODIgNTcuMTM1MiA4Mi40MjQyIDQxLjM5MDIgODguMjM1NyAzMS43NDgxQzk0LjE0OTkgMjEuOTM1NiAxMDEuNzQgMTYuNDQ2MiAxMTAuMjEzIDE0LjMyNDVDMTE4LjYwMSAxMi4yMjQyIDEyNy41MzIgMTMuNTAzMiAxMzYuMDg3IDE2LjU4NzZaTTExMS41NDkgMTkuNjU5OEMxMDQuNjU0IDIxLjM4NjQgOTguMjAzNSAyNS44NjQ2IDkyLjk0NjIgMzQuNTg3M0w5MC41OTA5IDMzLjE2NzdMOTIuOTQ2MiAzNC41ODczQzg3LjU4NjEgNDMuNDgwNSA4Mi4zOTU0IDU4LjU0NTMgNzcuOTQzIDc2LjcyNzNDNzMuNTA5IDk0LjgzMzkgNjkuODY2MyAxMTUuNzggNjcuNTA1NyAxMzYuMjYxQzY1LjE0NDEgMTU2Ljc1MiA2NC4wNzUyIDE3Ni42OTggNjQuNzYwNCAxOTIuODE1QzY1LjEwMzIgMjAwLjg3OCA2NS44ODIyIDIwNy45MSA2Ny4xMzAxIDIxMy41NDJDNjguMzk2MSAyMTkuMjU1IDcwLjA3MzggMjIzLjE4NSA3MS45NzY4IDIyNS4zNjRMNjkuOTIyNCAyMjcuMTU4TDcxLjk3NjggMjI1LjM2NEM3My43MjQ1IDIyNy4zNjYgNzYuMDY3OCAyMjguMzI5IDc5LjE4NDkgMjI4LjI5OEM4Mi40MDM2IDIyOC4yNjUgODYuMzc1OCAyMjcuMTU3IDkwLjk5NjEgMjI0Ljk3N0MxMDAuMjI1IDIyMC42MjQgMTExLjI0IDIxMi4zODYgMTIyLjUzMSAyMDIuMTYxQzE0NS4wODcgMTgxLjczMyAxNjguMDQ5IDE1NC4wMTkgMTc5LjA1OSAxMzUuNzUyQzE4OS45ODcgMTE3LjYyMSAxOTMuNDQzIDEwMS42NDMgMTkyLjAyMiA4Ny43MDYzQzE5MC41OTkgNzMuNzU3IDE4NC4yNiA2MS41NTU0IDE3NS4wODEgNTEuMDQzOEMxNjUuODE1IDQwLjQzMjkgMTUwLjEyOCAyNy40OTU5IDEzNC4yMjIgMjEuNzYxN0MxMjYuMjk1IDE4LjkwMzkgMTE4LjUzIDE3LjkxMTggMTExLjU0OSAxOS42NTk4WiIgZmlsbD0idXJsKCNwYWludDdfbGluZWFyXzMxMTZfOTU4KSIvPgo8cGF0aCBmaWxsLXJ1bGU9ImV2ZW5vZGQiIGNsaXAtcnVsZT0iZXZlbm9kZCIgZD0iTTEzMy43MDIgNTIuODYyOUMxNDUuMjY3IDU3LjAzMjMgMTU2LjMzOCA2Ni4yMzYgMTYyLjg0IDczLjY4MTRDMTY5LjQyOCA4MS4yMjYgMTc0LjE3NSA5MC4yMTg4IDE3NS4yNDEgMTAwLjY3M0MxNzYuMzA4IDExMS4xMzkgMTczLjY1NiAxMjIuNzc0IDE2NS45NjUgMTM1LjUzNEMxNTguMzU1IDE0OC4xNiAxNDIuNzM5IDE2Ni45NzQgMTI3LjQzIDE4MC44MzhDMTE5Ljc4OCAxODcuNzU5IDExMi4wNDkgMTkzLjYwNyAxMDUuMjg2IDE5Ni43OTdDMTAxLjkxIDE5OC4zODkgOTguNTc2NiAxOTkuNDE3IDk1LjUwMzIgMTk5LjQ0OEM5Mi4zMjgzIDE5OS40ODEgODkuMzkzIDE5OC40MzcgODcuMTk4OCAxOTUuOTI1Qzg1LjE1OTcgMTkzLjU5IDgzLjgzNzcgMTkwLjA0OCA4Mi45NDUxIDE4Ni4wMkM4Mi4wMzQ0IDE4MS45MSA4MS40OTU5IDE3Ni45MzIgODEuMjYwOSAxNzEuNDA1QzgwLjc5MDcgMTYwLjM0MyA4MS41MjU2IDE0Ni43OTIgODMuMTE3MSAxMzIuOTgzQzg0LjcwOTYgMTE5LjE2NSA4Ny4xNjkxIDEwNS4wMSA5MC4xNzY2IDkyLjcyODJDOTMuMTY1NyA4MC41MjIgOTYuNzU1NiA2OS45MTE5IDEwMC43MDUgNjMuMzU5MUMxMDQuNzU3IDU2LjYzNTggMTEwLjAwOCA1Mi44MDc2IDExNS45MTkgNTEuMzI3M0MxMjEuNzQ2IDQ5Ljg2ODQgMTI3Ljg5NCA1MC43Njg5IDEzMy43MDIgNTIuODYyOVpNMTE3LjI1NSA1Ni42NjI2QzExMi45MjEgNTcuNzQ3OCAxMDguODExIDYwLjU2NDggMTA1LjQxNiA2Ni4xOTgzTDEwMy4wNiA2NC43Nzg3TDEwNS40MTYgNjYuMTk4M0MxMDEuOTE3IDcyLjAwMjIgOTguNDgyOSA4MS45MzIxIDk1LjUxODggOTQuMDM2NEM5Mi41NzMyIDEwNi4wNjUgOTAuMTUwOCAxMTkuOTkxIDg4LjU4MDkgMTMzLjYxM0M4Ny4wMSAxNDcuMjQ0IDg2LjMwMTkgMTYwLjQ5IDg2Ljc1NiAxNzEuMTcxQzg2Ljk4MzIgMTc2LjUxNiA4Ny40OTg3IDE4MS4xNDcgODguMzE0OSAxODQuODNDODkuMTQ5MiAxODguNTk1IDkwLjIyNjkgMTkxLjAzMSA5MS4zNDE1IDE5Mi4zMDdDOTIuMzAwOCAxOTMuNDA1IDkzLjU4ODQgMTkzLjk2OCA5NS40NDcxIDE5My45NDlDOTcuNDA3MyAxOTMuOTI5IDk5LjkxODUgMTkzLjI0OCAxMDIuOTM5IDE5MS44MjNDMTA4Ljk3IDE4OC45NzggMTE2LjIzNCAxODMuNTU3IDEyMy43MzggMTc2Ljc2MUMxMzguNzIyIDE2My4xOTIgMTUzLjk2OCAxNDQuNzg0IDE2MS4yNTQgMTMyLjY5NUwxNjMuNjA5IDEzNC4xMTVMMTYxLjI1NCAxMzIuNjk1QzE2OC40NTggMTIwLjc0MiAxNzAuNjkzIDExMC4yODcgMTY5Ljc2OSAxMDEuMjMxQzE2OC44NDQgOTIuMTYyMiAxNjQuNzIzIDg0LjE5OTQgMTU4LjY5NyA3Ny4yOTkxTDE2MC43NjggNzUuNDkwMkwxNTguNjk3IDc3LjI5OTFDMTUyLjU4NCA3MC4yOTk0IDE0Mi4yNDkgNjEuNzkwNSAxMzEuODM3IDU4LjAzNjlDMTI2LjY1NyA1Ni4xNjk1IDEyMS42NzUgNTUuNTU2IDExNy4yNTUgNTYuNjYyNloiIGZpbGw9InVybCgjcGFpbnQ4X2xpbmVhcl8zMTE2Xzk1OCkiLz4KPHBhdGggZmlsbC1ydWxlPSJldmVub2RkIiBjbGlwLXJ1bGU9ImV2ZW5vZGQiIGQ9Ik0xMzEuMzE4IDg5LjEzNzlDMTM3LjM4OCA5MS4zMjY1IDE0My4xMDcgOTYuMTAyMSAxNDYuNDU2IDk5LjkzNjJDMTQ5Ljg5MSAxMDMuODcgMTUyLjQyIDEwOC42MjMgMTUyLjk4OCAxMTQuMTk3QzE1My41NTggMTE5Ljc4MiAxNTIuMTI3IDEyNS44OTUgMTQ4LjE2IDEzMi40NzdMMTQ1LjgwNSAxMzEuMDU3TDE0OC4xNiAxMzIuNDc3QzE0NC4yNzUgMTM4LjkyNCAxMzYuMzc0IDE0OC40MzIgMTI4LjYzOCAxNTUuNDM4QzEyNC43ODMgMTU4LjkzIDEyMC43OTQgMTYxLjk2MSAxMTcuMjMgMTYzLjY0MkMxMTUuNDUzIDE2NC40OCAxMTMuNTgxIDE2NS4wODEgMTExLjc2NiAxNjUuMDk5QzEwOS44NDkgMTY1LjExOSAxMDcuOTcgMTY0LjQ3NyAxMDYuNTY0IDE2Mi44NjdDMTA1LjMxMyAxNjEuNDM1IDEwNC41OTEgMTU5LjM4NyAxMDQuMTMgMTU3LjMwN0MxMDMuNjUxIDE1NS4xNDYgMTAzLjM3NiAxNTIuNTcgMTAzLjI1NyAxNDkuNzYxQzEwMy4wMTggMTQ0LjEzNSAxMDMuMzkyIDEzNy4yODMgMTA0LjE5MyAxMzAuMzM0QzEwNC45OTUgMTIzLjM3NiAxMDYuMjM0IDExNi4yNDEgMTA3Ljc1MyAxMTAuMDM3QzEwOS4yNTQgMTAzLjkwOCAxMTEuMDg3IDk4LjQzMzMgMTEzLjE3NSA5NC45Njk3QzExNS4zNjUgOTEuMzM1NiAxMTguMjc2IDg5LjE2ODcgMTIxLjYyNiA4OC4zMjk4QzEyNC44OTEgODcuNTEyMyAxMjguMjU2IDg4LjAzNDIgMTMxLjMxOCA4OS4xMzc5Wk0xMjIuOTYyIDkzLjY2NTFDMTIxLjE4OSA5NC4xMDkgMTE5LjQxOSA5NS4yNjQ2IDExNy44ODUgOTcuODA4OUMxMTYuMjQ5IDEwMC41MjQgMTE0LjU3MSAxMDUuMzE5IDExMy4wOTUgMTExLjM0NUMxMTEuNjM4IDExNy4yOTYgMTEwLjQzNiAxMjQuMjAyIDEwOS42NTcgMTMwLjk2NEMxMDguODc2IDEzNy43MzUgMTA4LjUyOSAxNDQuMjgxIDEwOC43NTIgMTQ5LjUyN0MxMDguODY0IDE1Mi4xNTQgMTA5LjExNiAxNTQuMzgyIDEwOS41IDE1Ni4xMTdDMTA5LjkwMyAxNTcuOTM0IDExMC4zOCAxNTguODc1IDExMC43MDcgMTU5LjI0OUwxMTAuNzA3IDE1OS4yNDlDMTEwLjg3OCAxNTkuNDQ1IDExMS4xMDkgMTU5LjYwNSAxMTEuNzEgMTU5LjU5OUMxMTIuNDExIDE1OS41OTIgMTEzLjQ2MSAxNTkuMzM4IDExNC44ODMgMTU4LjY2OEMxMTcuNzE1IDE1Ny4zMzIgMTIxLjIyOSAxNTQuNzI4IDEyNC45NDYgMTUxLjM2MUMxMzIuMzU3IDE0NC42NTEgMTM5Ljg4OCAxMzUuNTQ4IDE0My40NSAxMjkuNjM4QzE0Ni45MyAxMjMuODYzIDE0Ny45NDMgMTE4LjkzIDE0Ny41MTcgMTE0Ljc1NUMxNDcuMDkgMTEwLjU2NyAxNDUuMTg1IDEwNi44NDMgMTQyLjMxMyAxMDMuNTU0QzEzOS4zNTQgMTAwLjE2NSAxMzQuMzcgOTYuMDg0OCAxMjkuNDUyIDk0LjMxMkMxMjcuMDIgOTMuNDM0OSAxMjQuODIgOTMuMTk5OSAxMjIuOTYyIDkzLjY2NTFaIiBmaWxsPSJ1cmwoI3BhaW50OV9saW5lYXJfMzExNl85NTgpIi8+CjxwYXRoIGZpbGwtcnVsZT0iZXZlbm9kZCIgY2xpcC1ydWxlPSJldmVub2RkIiBkPSJNMjMwLjg3NCAxMTEuNzY0QzIzNi42MTMgMTA1LjUyOCAyMzYuMTQzIDk1Ljg4IDIyOS44MjggOTAuMjE0M0MyMjMuNTEzIDg0LjU0ODggMjEzLjc0MSA4NS4wMTEgMjA4LjAwNSA5MS4yNDczTDE2Ni44NTQgMTM1Ljk3MUwxNTAuMjE3IDExOC43MjJDMTQ0LjMzMyAxMTIuNjIxIDEzNC41NTMgMTEyLjM4NSAxMjguMzc0IDExOC4xOTZDMTIyLjE5NSAxMjQuMDA3IDEyMS45NTcgMTMzLjY2MyAxMjcuODQxIDEzOS43NjRMMTU1LjkzMyAxNjguODg5QzE1OC44OTIgMTcxLjk1NyAxNjMuMDExIDE3My42NzIgMTY3LjMwMyAxNzMuNjIyQzE3MS41OTMgMTczLjU3MiAxNzUuNjcxIDE3MS43NjMgMTc4LjU1NSAxNjguNjI2TDIzMC44NzQgMTExLjc2NFpNMTE0LjQwMyAxNTAuMDU3TDk2LjQ3OCAxMzIuMTk4TDExNC40MDMgMTE0LjM0QzExOC4yNzggMTEwLjUxMyAxMjAuMjE2IDEwNy4yNzEgMTIwLjIxNiAxMDQuNjEzQzEyMC4yMTYgMTAxLjg0OSAxMTguMjc4IDk4LjU1MzggMTE0LjQwMyA5NC43MjdDMTEwLjUyNyA5MC45MDAzIDEwNy4yNDQgODguOTg2OCAxMDQuNTUyIDg4Ljk4NjhDMTAxLjg2MSA4OC45ODY4IDk4LjU3NzMgOTAuOTAwMyA5NC43MDE4IDk0LjcyN0w3Ni45Mzg4IDExMi41ODZMNTkuMDE0MyA5NC43MjdDNTUuMTM4OCA5MC45MDAzIDUxLjg1NTIgODguOTg2OCA0OS4xNjM3IDg4Ljk4NjhDNDYuNTggODguOTg2OCA0My4yOTY1IDkwLjkwMDMgMzkuMzEzMyA5NC43MjdDMzUuNDM3OCA5OC41NTM4IDMzLjUgMTAxLjg0OSAzMy41IDEwNC42MTNDMzMuNSAxMDcuMjcxIDM1LjQzNzggMTEwLjUxMyAzOS4zMTMzIDExNC4zNEw1Ny4yMzggMTMyLjE5OEwzOS4zMTMzIDE1MC4wNTdDMzUuNDM3OCAxNTMuODg0IDMzLjUgMTU3LjE3OSAzMy41IDE1OS45NDNDMzMuNSAxNjIuNiAzNS40Mzc4IDE2NS44NDMgMzkuMzEzMyAxNjkuNjY5QzQzLjI5NjUgMTczLjM5IDQ2LjU4IDE3NS4yNSA0OS4xNjM3IDE3NS4yNUM1MS44NTUyIDE3NS4yNSA1NS4xMzg4IDE3My4zMzcgNTkuMDE0MyAxNjkuNTFMNzYuOTM4OCAxNTEuODExTDk0LjcwMTggMTY5LjUxQzk4LjU3NzMgMTczLjMzNyAxMDEuODYxIDE3NS4yNSAxMDQuNTUyIDE3NS4yNUMxMDcuMjQ0IDE3NS4yNSAxMTAuNTI3IDE3My4zOSAxMTQuNDAzIDE2OS42NjlDMTE4LjI3OCAxNjUuODQzIDEyMC4yMTYgMTYyLjYgMTIwLjIxNiAxNTkuOTQzQzEyMC4yMTYgMTU3LjE3OSAxMTguMjc4IDE1My44ODQgMTE0LjQwMyAxNTAuMDU3WiIgZmlsbD0id2hpdGUiLz4KPC9nPgo8ZGVmcz4KPGxpbmVhckdyYWRpZW50IGlkPSJwYWludDBfbGluZWFyXzMxMTZfOTU4IiB4MT0iMTg1LjE2NyIgeTE9Ii0yMzIuOTM4IiB4Mj0iNzAuODMyOSIgeTI9IjQ4OC45MzciIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIj4KPHN0b3Agb2Zmc2V0PSIwLjQ1IiBzdG9wLWNvbG9yPSIjMjI0N0ZGIi8+CjxzdG9wIG9mZnNldD0iMSIgc3RvcC1jb2xvcj0iIzBEMUM2NSIvPgo8L2xpbmVhckdyYWRpZW50Pgo8bGluZWFyR3JhZGllbnQgaWQ9InBhaW50MV9saW5lYXJfMzExNl85NTgiIHgxPSIxNzkuNDUiIHkxPSItMTk2Ljg0NCIgeDI9Ijc2LjU0OTgiIHkyPSI0NTIuODQ1IiBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+CjxzdG9wIG9mZnNldD0iMC40NSIgc3RvcC1jb2xvcj0iIzIyNDdGRiIvPgo8c3RvcCBvZmZzZXQ9IjEiIHN0b3AtY29sb3I9IiMwRDFDNjUiLz4KPC9saW5lYXJHcmFkaWVudD4KPGxpbmVhckdyYWRpZW50IGlkPSJwYWludDJfbGluZWFyXzMxMTZfOTU4IiB4MT0iMTczLjczMyIgeTE9Ii0xNjAuNzUiIHgyPSI4Mi4yNjYyIiB5Mj0iNDE2Ljc1IiBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+CjxzdG9wIG9mZnNldD0iMC40NSIgc3RvcC1jb2xvcj0iIzIyNDdGRiIvPgo8c3RvcCBvZmZzZXQ9IjEiIHN0b3AtY29sb3I9IiMwRDFDNjUiLz4KPC9saW5lYXJHcmFkaWVudD4KPGxpbmVhckdyYWRpZW50IGlkPSJwYWludDNfbGluZWFyXzMxMTZfOTU4IiB4MT0iMTY4LjAxNyIgeTE9Ii0xMjQuNjU3IiB4Mj0iODcuOTgzMSIgeTI9IjM4MC42NTgiIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIj4KPHN0b3Agb2Zmc2V0PSIwLjQ1IiBzdG9wLWNvbG9yPSIjMjI0N0ZGIi8+CjxzdG9wIG9mZnNldD0iMSIgc3RvcC1jb2xvcj0iIzBEMUM2NSIvPgo8L2xpbmVhckdyYWRpZW50Pgo8bGluZWFyR3JhZGllbnQgaWQ9InBhaW50NF9saW5lYXJfMzExNl85NTgiIHgxPSIxNjIuMyIgeTE9Ii04OC41NjI4IiB4Mj0iOTMuNjk5NyIgeTI9IjM0NC41NjIiIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIj4KPHN0b3Agb2Zmc2V0PSIwLjQ1IiBzdG9wLWNvbG9yPSIjMjI0N0ZGIi8+CjxzdG9wIG9mZnNldD0iMSIgc3RvcC1jb2xvcj0iIzBEMUM2NSIvPgo8L2xpbmVhckdyYWRpZW50Pgo8bGluZWFyR3JhZGllbnQgaWQ9InBhaW50NV9saW5lYXJfMzExNl85NTgiIHgxPSIxNTYuNTgzIiB5MT0iLTUyLjQ2OSIgeDI9Ijk5LjQxNjUiIHkyPSIzMDguNDciIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIj4KPHN0b3Agb2Zmc2V0PSIwLjQ1IiBzdG9wLWNvbG9yPSIjMjI0N0ZGIi8+CjxzdG9wIG9mZnNldD0iMSIgc3RvcC1jb2xvcj0iIzBEMUM2NSIvPgo8L2xpbmVhckdyYWRpZW50Pgo8bGluZWFyR3JhZGllbnQgaWQ9InBhaW50Nl9saW5lYXJfMzExNl85NTgiIHgxPSIxNTAuODY3IiB5MT0iLTE2LjM3NTMiIHgyPSIxMDUuMTMzIiB5Mj0iMjcyLjM3NSIgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiPgo8c3RvcCBvZmZzZXQ9IjAuNDUiIHN0b3AtY29sb3I9IiMyMjQ3RkYiLz4KPHN0b3Agb2Zmc2V0PSIxIiBzdG9wLWNvbG9yPSIjMEQxQzY1Ii8+CjwvbGluZWFyR3JhZGllbnQ+CjxsaW5lYXJHcmFkaWVudCBpZD0icGFpbnQ3X2xpbmVhcl8zMTE2Xzk1OCIgeDE9IjE0NS4xNSIgeTE9IjE5LjcxODUiIHgyPSIxMTAuODUiIHkyPSIyMzYuMjgxIiBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+CjxzdG9wIG9mZnNldD0iMC40NSIgc3RvcC1jb2xvcj0iIzIyNDdGRiIvPgo8c3RvcCBvZmZzZXQ9IjEiIHN0b3AtY29sb3I9IiMwRDFDNjUiLz4KPC9saW5lYXJHcmFkaWVudD4KPGxpbmVhckdyYWRpZW50IGlkPSJwYWludDhfbGluZWFyXzMxMTZfOTU4IiB4MT0iMTM5LjQzMyIgeTE9IjU1LjgxMjUiIHgyPSIxMTYuNTY2IiB5Mj0iMjAwLjE4OCIgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiPgo8c3RvcCBvZmZzZXQ9IjAuNDUiIHN0b3AtY29sb3I9IiMyMjQ3RkYiLz4KPHN0b3Agb2Zmc2V0PSIxIiBzdG9wLWNvbG9yPSIjMEQxQzY1Ii8+CjwvbGluZWFyR3JhZGllbnQ+CjxsaW5lYXJHcmFkaWVudCBpZD0icGFpbnQ5X2xpbmVhcl8zMTE2Xzk1OCIgeDE9IjEzMy43MTciIHkxPSI5MS45MDYzIiB4Mj0iMTIyLjI4MyIgeTI9IjE2NC4wOTQiIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIj4KPHN0b3Agb2Zmc2V0PSIwLjQ1IiBzdG9wLWNvbG9yPSIjMjI0N0ZGIi8+CjxzdG9wIG9mZnNldD0iMSIgc3RvcC1jb2xvcj0iIzBEMUM2NSIvPgo8L2xpbmVhckdyYWRpZW50Pgo8Y2xpcFBhdGggaWQ9ImNsaXAwXzMxMTZfOTU4Ij4KPHJlY3Qgd2lkdGg9IjI1NiIgaGVpZ2h0PSIyNTYiIHJ4PSI2MCIgZmlsbD0id2hpdGUiLz4KPC9jbGlwUGF0aD4KPC9kZWZzPgo8L3N2Zz4K';
  readonly url = 'https://xaman.app';

  private client: Xumm | null = null;
  private currentAccount: AccountInfo | null = null;
  private options: XamanAdapterOptions;

  constructor(options: XamanAdapterOptions = {}) {
    this.options = options;
  }

  /**
   * Xaman is always available (uses OAuth flow, no extension needed)
   */
  async isAvailable(): Promise<boolean> {
    return true;
  }

  async checkXamanState(options?: ConnectOptions): Promise<AccountInfo | null> {
    const apiKey = options?.apiKey || this.options.apiKey;
    const network = options?.network;

    if (!apiKey) {
      throw createWalletError.connectionFailed(
        this.name,
        new Error(
          'API key is required for Xaman. Please provide it in connect options or adapter constructor.'
        )
      );
    }

    this.client = new Xumm(apiKey);
    const address = await this.client.user.account;

    if (!address) {
      this.client.logout();
      return null;
    }

    // Resolve network if not provided
    let resolvedNetwork: NetworkInfo;
    if (network) {
      resolvedNetwork = this.resolveNetwork(network);
    } else {
      const xamanNetwork = await this.client.user.networkType;
      if (!xamanNetwork) {
        throw createWalletError.connectionFailed(
          this.name,
          new Error(
            'Unable to determine network from Xaman. Make sure the API key and network are correct.'
          )
        );
      }
      resolvedNetwork = this.parseNetwork(xamanNetwork);
    }

    this.currentAccount = {
      address,
      publicKey: undefined, // Xaman doesn't expose public key
      network: resolvedNetwork,
    };

    return this.currentAccount;
  }

  /**
   * Connect to Xaman wallet
   */
  async connect(options?: ConnectOptions): Promise<AccountInfo> {
    const apiKey = options?.apiKey || this.options.apiKey;

    if (!apiKey) {
      throw createWalletError.connectionFailed(
        this.name,
        new Error(
          'API key is required for Xaman. Please provide it in connect options or adapter constructor.'
        )
      );
    }

    // Merge runtime options with constructor options (runtime takes precedence)
    const onQRCode = (options as any)?.onQRCode || this.options.onQRCode;
    const onDeepLink = (options as any)?.onDeepLink || this.options.onDeepLink;

    // Temporarily store callbacks for use in openSignWindow
    if (onQRCode) {
      this.options.onQRCode = onQRCode;
    }
    if (onDeepLink) {
      this.options.onDeepLink = onDeepLink;
    }

    try {
      this.client = new Xumm(apiKey);
      logger.debug('Starting authorization flow');

      const authResult = await this.client.authorize();
      logger.debug('Authorization result:', {
        hasResult: !!authResult,
        isError: authResult instanceof Error,
        hasMe: authResult && !(authResult instanceof Error) ? !!authResult.me : false,
      });

      if (!authResult || authResult instanceof Error) {
        throw authResult || new Error('Authorization failed');
      }

      logger.debug('Authorization successful', { account: authResult.me?.account });

      const account = authResult.me.account;
      const network: NetworkInfo = this.parseNetwork(authResult.me.networkEndpoint || '');

      this.currentAccount = {
        address: account,
        publicKey: undefined, // Xaman doesn't expose public key in authorize response
        network,
      };

      return this.currentAccount;
    } catch (error) {
      logger.error('Authorization failed:', error);
      throw createWalletError.connectionFailed(this.name, error as Error);
    }
  }

  /**
   * Disconnect from Xaman
   */
  async disconnect(): Promise<void> {
    if (!this.client) {
      return;
    }

    try {
      await this.client.logout();
      this.cleanup();
    } catch (error) {
      // Logout might fail if already logged out, that's okay
      this.cleanup();
    }
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
   * Note: Xaman only supports signing via popup flow. The submit parameter is ignored.
   * Users must submit the signed transaction separately or use Xaman's auto-submit feature.
   */
  async signAndSubmit(transaction: Transaction, _submit?: boolean): Promise<SubmittedTransaction> {
    if (!this.client || !this.currentAccount) {
      throw createWalletError.notConnected();
    }

    try {
      // Create and subscribe to payload
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const payload: any = await this.client.payload?.createAndSubscribe(transaction as any);

      if (!payload) {
        throw new Error('Failed to create payload');
      }

      // Open popup window for signing
      this.openSignWindow(payload.created.next.always);

      // Wait for WebSocket response
      const result = await this.waitForSignature(payload.websocket.url);

      if (!result.signed) {
        throw createWalletError.signRejected();
      }

      // Xaman only signs; submission depends on user's wallet settings
      // The submit parameter is documented but not used for Xaman
      return {
        hash: result.txid || '',
        tx_blob: result.tx_blob,
        signature: result.signature,
      };
    } catch (error) {
      if (error instanceof Error && error.message.includes('rejected')) {
        throw createWalletError.signRejected();
      }
      throw createWalletError.signFailed(error as Error);
    }
  }

  /**
   * Sign a message (for authentication/verification)
   */
  async signMessage(message: string | Uint8Array): Promise<SignedMessage> {
    if (!this.client || !this.currentAccount) {
      throw createWalletError.notConnected();
    }

    try {
      // Convert message to string if Uint8Array
      const messageStr = typeof message === 'string' ? message : new TextDecoder().decode(message);

      // Use SignIn payload type for message signing
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const payload: any = await this.client.payload?.create({
        TransactionType: 'SignIn',
      });

      if (!payload) {
        throw new Error('Failed to create sign message payload');
      }

      // Open popup for signing
      this.openSignWindow(payload.next.always);

      // Note: Xaman doesn't directly support arbitrary message signing
      // This is a simplified implementation - in production, you'd use a custom payload
      // or implement a different approach (like signing a memo field)

      return {
        message: messageStr,
        signature: '', // Would need to extract from Xaman response
        publicKey: this.currentAccount.publicKey || '',
      };
    } catch (error) {
      throw createWalletError.signFailed(error as Error);
    }
  }

  /**
   * Parse network from endpoint URL
   */
  private parseNetwork(endpoint: string): NetworkInfo {
    const normalized = endpoint.toLowerCase();

    if (normalized.includes('testnet') || normalized.includes('altnet')) {
      return {
        id: 'testnet',
        name: 'Testnet',
        wss: endpoint,
        walletConnectId: 'xrpl:1',
      };
    }

    if (normalized.includes('devnet')) {
      return {
        id: 'devnet',
        name: 'Devnet',
        wss: endpoint,
        walletConnectId: 'xrpl:2',
      };
    }

    // Default to mainnet
    return {
      id: 'mainnet',
      name: 'Mainnet',
      wss: endpoint || 'wss://xrplcluster.com',
      walletConnectId: 'xrpl:0',
    };
  }

  /**
   * Open popup window for signing or trigger QR code callback
   */
  private openSignWindow(url: string): void {
    logger.debug('openSignWindow called with URL:', url.substring(0, 50) + '...');
    logger.debug('onQRCode callback exists:', !!this.options.onQRCode);

    // If QR code callback is provided, use that instead of popup
    if (this.options.onQRCode) {
      logger.debug('Calling onQRCode callback');
      this.options.onQRCode(url);
      return;
    }

    // Otherwise, open popup (legacy behavior)
    logger.debug('Opening popup window');
    const width = 500;
    const height = 600;
    const left = window.screen.width / 2 - width / 2;
    const top = window.screen.height / 2 - height / 2;

    window.open(
      url,
      'Xaman Sign',
      `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
    );
  }

  /**
   * Get deep link URI for mobile (Xaman app)
   */
  public getDeepLinkURI(url: string): string {
    if (this.options.onDeepLink) {
      return this.options.onDeepLink(url);
    }
    // Xaman deep link format
    return `xumm://xumm.app/sign/${url.split('/').pop()}`;
  }

  /**
   * Wait for signature via WebSocket
   */
  private waitForSignature(wsUrl: string): Promise<{
    signed: boolean;
    txid?: string;
    tx_blob?: string;
    signature?: string;
    account?: string;
  }> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(wsUrl);
      const timeout = setTimeout(
        () => {
          ws.close();
          reject(new Error('Signing timeout - user did not respond'));
        },
        5 * 60 * 1000
      ); // 5 minute timeout

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.signed === true) {
            clearTimeout(timeout);
            ws.close();
            resolve({
              signed: true,
              txid: data.txid,
              tx_blob: data.tx_blob,
              signature: data.signature,
              account: data.account,
            });
          } else if (data.signed === false) {
            clearTimeout(timeout);
            ws.close();
            reject(new Error('Transaction signing was rejected by user'));
          }
        } catch (error) {
          clearTimeout(timeout);
          ws.close();
          reject(error);
        }
      };

      ws.onerror = (error) => {
        clearTimeout(timeout);
        reject(new Error('WebSocket error: ' + error));
      };

      ws.onclose = () => {
        clearTimeout(timeout);
      };
    });
  }

  /**
   * Cleanup adapter state
   */
  private cleanup(): void {
    this.client = null;
    this.currentAccount = null;
    // Don't clear pending payload on disconnect - it might still be needed
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
}
