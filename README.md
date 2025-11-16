# GitHub Contribution Merge

> Merge and display GitHub contribution graphs from multiple accounts on your profile.

A Cloudflare Worker that generates combined contribution graphs from multiple GitHub accounts. Perfect for developers who maintain separate personal and work accounts.

## Features

- **Merge Multiple Accounts** - Combine contributions from personal, work, and side project accounts
- **Themes** - Dark, Light, Solarized, Nord color schemes and potentially more
- **Authorization System** - Ensures each additional account is only ever claimed by one user

## Quick Start

### Prerequisites

- GitHub Personal Access Token
  - **Recommended**: PAT (classic) with `read:user` scope
  - Fine-grained PAT with Repository metadata read-only.
- Cloudflare account (free tier works)
- pnpm package manager

### GitHub Token Setup

Create a Personal Access Token (classic) at https://github.com/settings/tokens

1. Click "Generate new token" > "Generate new token (classic)"
2. Select scopes:
   - `read:user` - Read user profile data (required)
3. Generate and copy the token

**Note**: PAT (classic) is recommended. A fine-grained PAT with metadata read-only
will also work but returns slightly different contribution data.

### Setup

**First, fork this repository** using the "Fork" button at the top of this page.

```bash
# Clone your fork
git clone https://github.com/YOUR-USERNAME/github-contribution-merge.git
cd github-contribution-merge

# Install dependencies
pnpm install

```

## Local Development

Create `.dev.vars` file:

```bash
GITHUB_TOKEN=ghp_your_token_here
PRIMARY_USER=primary-user
```

Testing locally you can confirm the `primary-user` works along with any additional `merge` users.

```
npm dev

http://localhost:8787/?merge=alice-corp&years=3
```

## Authorization System

Additional `merge` users must explicitly authorize the `primary-user` via a public gist.

### For Additional Users

**Important: You must log in to each additional GitHub account and create a
public gist to allow access.**

Create a public gist at https://gist.github.com/ for each additional user with:
- **Filename**: `github-contribution-merge-allow-PRIMARY_USER.md` (replace PRIMARY_USER with actual username)
- **Content**: Can be empty or contain any text

Example: If `alice` wants to merge contributions from `alice-corp`:

1. Log in to `alice-corp` GitHub account
2. `alice-corp` creates a public gist with filename: `github-contribution-merge-allow-alice.md`
3. `alice` can then use the `?merge=alice-corp` query parameter to merge contributions from `alice-corp`.

Revoke access by deleting the gist.

## Deploying to Cloudflare

Set the secrets that are required for the worker to function.

```bash
# Configure secrets (you'll be prompted to enter the values)
pnpm wrangler secret put GITHUB_TOKEN
pnpm wrangler secret put PRIMARY_USER

# Deploy to Cloudflare
pnpm run deploy
```

Your worker will be deployed to: `https://github-contribution-merge.YOUR-SUBDOMAIN.workers.dev`

**Environment Variables:**
- `GITHUB_TOKEN` - Your GitHub Personal Access Token (secret)
- `PRIMARY_USER` - Your GitHub username (the owner of this worker)

## Embed in Your Profile

Add to your GitHub profile README (`your-username/your-username/README.md`):

**Replace `https://your-worker.workers.dev` with your actual worker URL from the deployment step.**

```markdown
<!-- Link back to this repo so others can discover this project <3 -->
<a href="https://github.com/bshore/github-contribution-merge" target="_blank">
    <img src="https://your-worker.workers.dev/?merge=work-account&years=3" alt="Contributions">
</a>

<!-- Or as a standalone markdown image </3-->
![Contributions](https://your-worker.workers.dev/?merge=work-account&years=3)
```

### URL Parameters

- `merge` - Comma-separated additional usernames to merge (must be authorized via public gist)
- `years` - Number of years to display back from current year (stops at 2008 when GitHub was founded, default: 1)
- `theme` - Color scheme (see below)

### Available Themes

- `dark` - GitHub dark mode (default)
- `light` - GitHub light mode
- `solarized-dark` - Solarized Dark
- `solarized-light` - Solarized Light
- `nord-polar-night` - Nord Dark Grays
- `nord-frost` - Nord Blues/Cyans
- `nord-aurora` - Nord Green to Red Accents

## Examples

```markdown
# Personal + work account, 3 years, dark theme
![Contributions](https://your-worker.workers.dev/?merge=work-account&years=3&theme=dark)

# Multiple accounts, Nord Frost theme
![Contributions](https://your-worker.workers.dev/?merge=corp-account,side-project&theme=nord-frost)

# Primary user only
![Contributions](https://your-worker.workers.dev/?theme=light)
```

## Known Limitations

- **API behavior**: The GitHub GraphQL API may return fewer contributions than shown on profile pages. This is a documented GitHub API limitation.
- **Private contributions**: Users must enable "Show private contributions on my profile" in GitHub settings for their private contributions to appear.

## Troubleshooting

### Additional account not showing

1. Verify gist is public with exact filename pattern: `github-contribution-merge-allow-{PRIMARY_USER}.md`
2. Ensure primary username in filename matches exactly (case-sensitive)
3. Confirm user is in `?merge=` parameter
4. Check Cloudflare Workers logs for authorization warnings

### Only seeing "joined GitHub" event

The additional user needs to enable private contributions:
1. Go to https://github.com/settings/profile
2. Under "Contributions & Activity"
3. Check "Private contributions"

## Contributing

Found a bug or have a feature request? Please [open an issue](https://github.com/bshore/github-contribution-merge/issues).

## Acknowledgments

This project uses color themes from:
- [Solarized](https://github.com/altercation/solarized) by Ethan Schoonover (MIT License)
- [Nord](https://github.com/nordtheme/nord) by Arctic Ice Studio (MIT License)

## License

MIT
