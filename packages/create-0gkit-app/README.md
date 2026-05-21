# create-0gkit-app

Scaffold a [0G](https://0g.ai) app in seconds.

```bash
npm create 0gkit-app@latest my-app
```

`create-0gkit-app` clones a starter template, installs dependencies, writes a
network-aware `.env.example`, optionally `git init`s the project, and prints a
"next step" banner.

## Templates

| Name                 | Use case                                                           |
| -------------------- | ------------------------------------------------------------------ |
| `storage-app`        | Upload + download a file, verify the Merkle root.                  |
| `inference-app`      | OpenAI-shaped chat against 0G Compute.                             |
| `attestation-verify` | Parse + verify a TEE attestation report.                           |
| `mcp-agent`          | Expose every 0G primitive as MCP tools for agent runtimes.         |
| `react-app`          | Next.js App Router app using `@foundryprotocol/0gkit-react` hooks. |

## Usage

```bash
npm create 0gkit-app@latest my-app --template storage-app --network local
```

## License

MIT
