# Plan: deploy from a production branch, pulled by the server

Date: 19 October 2026. Status: planned. Steps 1 and 2 are ready but not committed; the rest
waits for them.

Until now the Deploy workflow built the site and uploaded it to the web root over FTP. This
plan replaces the upload with git: GitHub builds the site into a `production` branch, and the
server pulls that branch itself.

## Why

- No FTP password in GitHub, and no `.ftp-deploy-sync-state.json` on the server.
- Git updates the files in one checkout instead of one by one over FTP.
- The server cannot run anything after a deploy: DirectAdmin's git deploy has no post-deploy
  scripts, and there is no Composer on the server. So `production` must already contain
  everything, including `.api/vendor/`.
- DirectAdmin's git deploy needs a manual fetch and pull. A cron job does that instead, without
  waiting for the hoster (asked on 19 October whether a webhook is possible).

`.api/vendor/` stays out of master. It is in `production` only, about 1.9 MB, and git stores
unchanged files once, so the branch only grows when `composer.lock` changes.

## How it works

```
push to master
  → Deploy workflow: lint, build, composer install --no-dev, unit tests
  → commit the finished site to the production branch
  → cron on the server, every minute: git fetch + git reset --hard to production
```

### The production branch

The web root as it should be on the server: the built app (`index.html`, `_app/`),
`assets/`, `.htaccess`, `favicon.png`, and `.api/` including `vendor/`.

Left out: `.app/`, `.docs/`, `.scripts/`, `.github/`, `.agents/`, `.claude/`, `.api/tests/`,
`README.md`, `LICENSE`, and master's `.gitignore`.

It gets its own `.gitignore` with the runtime folders that exist only on the server:

```
.api/cache/
.api/data/
.api/logs/
.api/.env
.logs/
```

Git leaves ignored files alone on checkout, `reset --hard`, and `clean -fd`, so the war log
database survives every deploy.

### The workflow (`.github/workflows/deploy.yml`)

Same build and test steps as before, then instead of the FTP upload:

1. Clone `production` into `$RUNNER_TEMP/production` (depth 1), or `git init` it on the first
   run, so the branch starts without master's history.
2. `rsync --archive --delete` the workspace into it, with the exclusions above.
3. Write the branch's `.gitignore`.
4. Commit as `github-actions[bot]` with the message `Deploy <short sha>: <master subject>`,
   and push to `production`. Skip the commit when nothing changed.

It pushes with the built-in `github.token` (`permissions: contents: write`); the `FTP_*`
secrets are no longer used.

### The cron job on the server

The repository is public, so the server fetches without credentials. Every minute:

```
* * * * * ( cd /home/USER/domains/fatt.fali.se/public_html/_test && { [ -d .git ] || { git init -q && git remote add origin https://github.com/FaliseDotCom/foxhole-awesome-tracking-tool.git; }; } && git fetch -q origin production && git reset -q --hard FETCH_HEAD ) >/dev/null 2>&1
```

- The first run turns the folder into a git clone, so no SSH is needed.
- `reset --hard` makes the tracked files match `production` exactly, deletions included,
  and never touches untracked or ignored files.
- The whole command is in parentheses so the redirect covers every part of it and cron never
  sends mail. While testing, use `>> ~/deploy.log 2>&1` instead.
- `.htaccess` hides `.git/` like every other dot folder.

A push is live about a minute after the workflow finishes.

## Steps

1. **Workflow.** Replace the FTP upload in `.github/workflows/deploy.yml` with the production
   branch steps above.
2. **Docs.** README "Hosting it" and `.docs/CONTRIBUTING.md` describe the production branch
   (done, not committed). Add the cron line to "Hosting it" once step 4 confirms it works.
3. **Commit and push** the workflow and docs together. The first run creates `production`;
   check on GitHub that it has `.api/vendor/` and no source folders.
4. **Check that cron can run git.** One-off cron job, then read the log and remove the job:
   `git --version > ~/git-test.log 2>&1`
5. **Switch `_test` over.** Stop the DirectAdmin git deploy for `_test`, empty the folder
   (it holds no data yet), and add the cron job.
6. **Test on `_test`:**
   - The map loads and `/api/...` answers (the vendor folder works).
   - `/README.md`, `/.git/`, `/.api/`, and `/.api/.env.example` give a 404.
   - Put a dummy file in `.api/data/`, push a change to master, and check that the change
     arrives and the dummy file is still there.
7. **Switch the real web root.** Same cron line with its path. That folder already has files
   from FTP; `reset --hard` overwrites the tracked ones and keeps `.api/data/`. Delete
   `.ftp-deploy-sync-state.json` by hand once.
8. **Clean up.** Remove the `_test` cron job and folder, and delete the `FTP_*` secrets in
   GitHub.

## Rolling back

- A bad deploy: revert the commit on master and push; the next run publishes the reverted
  site. In a hurry, `git reset --hard <earlier production commit>` on the server works until
  the next cron run, so pause the cron job first.
- The whole approach: the old FTP workflow is in master's history.

## Open questions

- Can the hoster trigger the pull with a webhook? If so, it replaces the cron job; the
  production branch stays the same.
- Does the cron environment have `git`? Step 4 answers this. If not, the fallback is a PHP
  endpoint the workflow calls after pushing, which downloads the branch as a zip from GitHub
  and unpacks it with `ZipArchive` (no shell needed), protected by a shared secret.
