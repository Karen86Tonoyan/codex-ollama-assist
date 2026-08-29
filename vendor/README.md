# vendor/

`codex/` is a **git submodule** of https://github.com/Karen86Tonoyan/codexOPENSOURCE

```powershell
git submodule update --init --depth 1 vendor/codex
```

Do not copy the full Bazel tree into this repo. Point Codex at Ollama with `scripts/use-ollama-for-codex.ps1`.
