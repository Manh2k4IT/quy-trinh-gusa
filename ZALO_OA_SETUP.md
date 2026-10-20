# Zalo OA proposal notifications

Gusa sends a group message to an OA-managed GMF group and individual text messages containing a link to the proposal in Gusa. The link does not approve anything by itself: reviewers must sign in to Gusa, and the existing proposal API checks their role and the current review stage before saving a decision. Final decisions and management-to-accounting handoffs are sent to the proposer's linked Zalo account.

Zalo's currently documented OA APIs do not provide customizable approve/reject buttons with callbacks for either GMF group messages or consultative 1:1 messages. The 1:1 `request_user_info` template is for collecting profile information and cannot be repurposed for approvals.

## Zalo prerequisites

1. In Zalo Developer, confirm the OA-linked app has the required OpenAPI messaging permissions. An app shown under OA Manager's "Quản lý liên kết" does not by itself confirm the required permissions or usable credentials.
2. Confirm the OA package and verification status include GMF. GMF's developer documentation still references older Advanced/Premium package names; verify current package eligibility in OA Manager before relying on group messaging.
3. Create or choose an active GMF group managed by this OA and obtain its `group_id`.
4. Obtain the OA app ID, app secret, and initial refresh token through the official Zalo Developer authorization flow. Do not paste credentials into chat or commit them to the repository.
5. For 1:1 messages, users must be known Zalo OA users, must not have blocked the OA, and generally must have interacted with the OA within the allowed consultative-message window. Obtain their OA user IDs through the authorized OA APIs; do not infer Zalo IDs from phone numbers.

## Deployment configuration

Set these variables in the server's secret/environment configuration:

| Variable | Purpose |
| --- | --- |
| `ZALO_APP_ID` | Zalo Developer app ID |
| `ZALO_APP_SECRET` | App secret used for OA token refresh |
| `ZALO_REFRESH_TOKEN` | Initial OA refresh token |
| `ZALO_TOKEN_ENCRYPTION_KEY` | A unique random secret of at least 32 characters used to encrypt rotated OA tokens at rest |
| `ZALO_GROUP_ID` | Active OA-managed GMF group ID |
| `ZALO_PAYMENT_GROUP_ID` | Optional GMF group for payment proposals (message and images); falls back to `ZALO_GROUP_ID` when empty |
| `ZALO_APPROVED_GROUP_ID` | Optional GMF group that receives final-approved proposals (message and document images); nothing is sent when empty |
| `ZALO_USER_ID_MAP` | JSON object mapping Gusa user IDs to Zalo OA user IDs |

Example mapping shape only (replace with actual IDs in the deployment secret manager):

```json
{"gusa-user-id":"zalo-user-id"}
```

The server refreshes OA access tokens as needed and stores the rotated access/refresh tokens encrypted in `DATA_DIR/zalo-oa-tokens.json`. The encryption key must remain stable across deploys, and `DATA_DIR` must be on persistent storage so a rotated refresh token is not lost. The initial refresh token is read from the environment only when the encrypted token file does not yet exist.

If credentials or destinations are absent, Zalo notifications remain disabled and the normal Gusa proposal flow continues. API failures are logged without logging tokens or message credentials. Zalo's API may reject 1:1 messages when a recipient is outside the allowed interaction window; group delivery and direct-message delivery are handled independently.

## Re-authorizing when the refresh token expires (error -14014)

If the log shows `Không thể làm mới token Zalo OA (mã -14014)`, the stored refresh token is invalid:

1. Sign in to Gusa as Admin/CEO.
2. Open the OA authorization URL (`https://oauth.zaloapp.com/v4/oa/permission?app_id=<ZALO_APP_ID>&redirect_uri=<URL-encoded https://quytrinh.gusa.vn/zalo/oauth/callback>`) and approve. The callback stores the new encrypted tokens.
3. If you instead set a new `ZALO_REFRESH_TOKEN`, delete the old `DATA_DIR/zalo-oa-tokens.json` first, because the file takes precedence over the environment variable.
4. Run the OA on only one server; two servers sharing one OA invalidate each other's rotating refresh tokens.

## Approval links and authorization

Proposal links use `proposal-report.html?proposalId=...` (and `type=payment` for payment proposals). The page filters to the selected proposal. Approval and rejection still require a signed-in active Gusa account authorized for that proposal's current stage; the link itself is not a bearer approval token.

## Official references

- [GMF overview](https://developers.zalo.me/docs/official-account/nhom-chat-gmf/general)
- [Send a GMF group text message](https://developers.zalo.me/docs/official-account/nhom-chat-gmf/tin-nhan/text_message)
- [Conditions for consultative 1:1 messages](https://developers.zalo.me/docs/official-account/tin-nhan/tin-tu-van/dieu-kien-gui-tin-tu-van)
- [OA OAuth and token refresh](https://developers.zalo.me/docs/api/oauth-4-0-1634#tim-lai-access-token-b-ng-refresh-token)
