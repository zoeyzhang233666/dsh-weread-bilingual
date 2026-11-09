# Publishing checklist

## 1. GitHub (done when the public repo exists)

```sh
git status
npm test
npm run build
git add -A
git commit -m "Release packaging for npm and the DSH plugin marketplace."
git push -u origin HEAD
```

## 2. npm login (once per machine)

Create an account at https://www.npmjs.com/ if needed, then:

```sh
npm login
npm whoami
```

## 3. Dry-run pack

```sh
npm run pack:dist
# Inspect the tarball: no Cookie, no node_modules, includes client.js + host src
tar -tzf dsh-weread-bilingual-0.1.6.tgz | head
```

Install the tarball into a throwaway profile if you want:

```sh
dsh plugin --profile web add -w ./dsh-weread-bilingual-0.1.6.tgz
```

## 4. Publish

```sh
npm publish --access public
```

After publish, marketplace / CLI install is:

```text
dsh-weread-bilingual
```

```sh
dsh plugin --profile desktop add -w dsh-weread-bilingual
```

## 5. Version bumps

Use semver. After a user-visible change:

1. Bump `"version"` in the root `package.json`
2. `npm run build && npm test`
3. Commit, tag optional `v0.1.6`, push
4. `npm publish`

Host/client folders are `private: true` and are **not** published as separate packages.
