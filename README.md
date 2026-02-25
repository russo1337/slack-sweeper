![Slack Sweeper Logo](ressources/logo-full.png)

# Slack Sweeper Chrome Extension

Chrome extension to deactivate Slack users from a CSV using your current Slack admin session.

## Who It Is For / What It Solves
This extension is for Slack Admins on a Premium plan who want to bulk deactivate users when there is no bulk deactivation function available in the Slack API or the web UI.

## Notes
- This works for Slack premium plans.
- Slack Business has a built-in bulk deactivation function.

## Quick Start
1. Open Chrome and go to Extensions (`chrome://extensions`).
2. Enable `Developer mode`.
3. Click `Load unpacked` and select `chrome-extension/`.
4. Open your Slack admin page (for example `https://your-workspace.slack.com/admin`).
5. Click the extension icon, select a CSV (one user ID per line), and run.

## CSV Format
- One Slack user ID per line.
- Example:

```text
U0123456789
U0987654321
```

## Recommended CSV Workflow
Best way to get the CSV:
1. Go to `https://yourdomain.slack.com/admin`.
2. Open `People`.
3. Open `Member`.
4. Export the full list.
5. Filter the list.
6. Use the CSV with this extension.

## Project Structure
- `chrome-extension/`: Chrome extension source
- `slack-sweeper.zip`: packaged extension ZIP (for upload/distribution)
- `ressources/logo-full.png`: project logo used in this README
