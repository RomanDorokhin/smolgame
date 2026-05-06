# GitHub OAuth Setup Guide

## Overview

This guide explains how to set up GitHub OAuth for seamless game deployment. Users can login with one click and deploy games instantly.

## What You Get

- ✅ One-click GitHub login
- ✅ No manual token entry
- ✅ Automatic game deployment
- ✅ Secure OAuth flow
- ✅ User profile display

## Step 1: Create GitHub OAuth App

1. Go to https://github.com/settings/developers
2. Click "New OAuth App"
3. Fill in the form:
   - **Application name**: OpenSmolGame
   - **Homepage URL**: `https://yourdomain.com` (or `http://localhost:3000` for dev)
   - **Authorization callback URL**: `https://yourdomain.com/auth/github/callback` (or `http://localhost:3000/auth/github/callback` for dev)
4. Click "Register application"
5. Copy your **Client ID** (you'll need this)
6. Click "Generate a new client secret" and copy it

## Step 2: Store Credentials

### Environment Variables

Add to your `.env` file:

```bash
GITHUB_CLIENT_ID=your_client_id_here
GITHUB_CLIENT_SECRET=your_client_secret_here
```

### In Your App

```typescript
// In your main App.tsx or layout
const githubClientId = process.env.REACT_APP_GITHUB_CLIENT_ID!;
```

## Step 3: Backend Setup

Add the OAuth handler to your Express server:

```typescript
// In server/routers.ts or server/_core/index.ts

import { createGitHubOAuthRouter } from '@/lib/githubOAuthHandler';

const app = express();
app.use(express.json());

// Add GitHub OAuth routes
const githubRouter = createGitHubOAuthRouter(
  process.env.GITHUB_CLIENT_ID!,
  process.env.GITHUB_CLIENT_SECRET!
);

app.use('/api', githubRouter);
```

## Step 4: Frontend Setup

### Add OAuth Callback Route

```typescript
// In client/src/App.tsx

import { Route } from 'wouter';

function Router() {
  return (
    <Switch>
      <Route path="/auth/github/callback" component={GitHubCallbackPage} />
      {/* ... other routes ... */}
    </Switch>
  );
}
```

### Create Callback Handler Page

```typescript
// client/src/pages/GitHubCallbackPage.tsx

import React, { useEffect } from 'react';
import { useLocation } from 'wouter';

export default function GitHubCallbackPage() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    // OAuth callback is handled by GitHubLoginButton component
    // Just redirect back to main page after a moment
    setTimeout(() => {
      setLocation('/');
    }, 1000);
  }, [setLocation]);

  return (
    <div style={{ textAlign: 'center', padding: '40px' }}>
      <h2>Connecting to GitHub...</h2>
      <p>Please wait while we complete your login.</p>
    </div>
  );
}
```

### Add Login Button to Your UI

```typescript
// In your main chat or layout component

import GitHubLoginButton from '@/components/GitHubLoginButton';

export function GameDesignChat() {
  const githubClientId = process.env.REACT_APP_GITHUB_CLIENT_ID!;

  return (
    <div className="game-design-chat">
      {/* Your chat UI */}

      <GitHubLoginButton
        clientId={githubClientId}
        onLoginSuccess={(user, token) => {
          console.log('Logged in as:', user.login);
          // User is now authenticated
        }}
        onLoginError={(error) => {
          console.error('Login failed:', error);
        }}
      />

      {/* Deployment UI */}
      <GameDeploymentUIWithOAuth
        htmlCode={currentGameHtml}
        gameSpec={gameSpec}
        githubClientId={githubClientId}
      />
    </div>
  );
}
```

## Step 5: Update Deployment UI

Replace old deployment component:

```typescript
// Before (old version with manual token)
import GameDeploymentUI from '@/components/GameDeploymentUI';

// After (OAuth version)
import GameDeploymentUIWithOAuth from '@/components/GameDeploymentUIWithOAuth';

// Use it:
<GameDeploymentUIWithOAuth
  htmlCode={htmlCode}
  gameSpec={gameSpec}
  githubClientId={githubClientId}
  onDeploymentComplete={(result) => {
    console.log('Game deployed:', result.gameUrl);
  }}
/>
```

## Files to Copy

1. **githubOAuthClient.ts** → `client/src/lib/`
   - OAuth client for frontend

2. **githubOAuthHandler.ts** → `server/`
   - OAuth handler for backend

3. **GitHubLoginButton.tsx** → `client/src/components/`
   - Login button component

4. **GitHubLoginButton.css** → `client/src/components/`
   - Button styling

5. **githubGameDeployerOAuth.ts** → `client/src/lib/`
   - Deployment using OAuth token

6. **GameDeploymentUIWithOAuth.tsx** → `client/src/components/`
   - Updated deployment UI

## User Flow

```
1. User sees "Sign in with GitHub" button
   ↓
2. Clicks button
   ↓
3. Redirected to GitHub login (if not already logged in)
   ↓
4. GitHub shows permission request
   ↓
5. User clicks "Authorize"
   ↓
6. Redirected back to your app
   ↓
7. Token exchanged securely on backend
   ↓
8. User profile displayed
   ↓
9. User can deploy games instantly
```

## Security

### Token Exchange

- **Frontend**: Receives authorization code from GitHub
- **Backend**: Exchanges code for access token (client secret never exposed)
- **Frontend**: Receives access token and stores in localStorage
- **All API calls**: Use access token from localStorage

### Scopes

The OAuth app requests these scopes:
- `repo` - Full control of private repositories
- `workflow` - Update GitHub Actions workflows

Users can see exactly what permissions are being requested.

### Token Storage

- Stored in localStorage (accessible to JavaScript)
- Never sent to your backend (except for initial exchange)
- User can revoke on GitHub anytime

## Troubleshooting

### "Invalid Client ID"
- Check that Client ID is correct
- Verify it matches the one in GitHub settings
- Check environment variable is set

### "Redirect URI mismatch"
- Ensure redirect URI in GitHub settings matches your app
- For development: `http://localhost:3000/auth/github/callback`
- For production: `https://yourdomain.com/auth/github/callback`

### "Token exchange failed"
- Check that Client Secret is correct
- Verify backend has access to environment variables
- Check network tab for failed requests

### "User info not loading"
- Verify token is valid
- Check GitHub API status
- Try logging out and logging back in

## Testing

### Local Development

1. Set environment variables:
   ```bash
   REACT_APP_GITHUB_CLIENT_ID=your_client_id
   GITHUB_CLIENT_SECRET=your_client_secret
   ```

2. Start your dev server:
   ```bash
   npm run dev
   ```

3. Click "Sign in with GitHub"

4. You should be redirected to GitHub, then back to your app

5. Your profile should be displayed

### Deployment

1. Add environment variables to your hosting platform
2. Update GitHub OAuth app settings with production URLs
3. Test the full flow on production

## Advanced: Multiple Environments

If you have dev, staging, and production:

1. Create separate OAuth apps for each environment
2. Use different Client IDs for each
3. Update GitHub OAuth app redirect URIs for each environment

## Support

For issues:
1. Check browser console for errors
2. Check network tab for failed requests
3. Verify GitHub API status at https://www.githubstatus.com/
4. Review GitHub OAuth documentation at https://docs.github.com/en/developers/apps/building-oauth-apps

---

**Version**: 1.0.0
**Status**: Production Ready
**Last Updated**: 2026-05-06
