# Legacy Python client (frozen)

`sheypoor.py` here is the **original Python implementation** of the Sheypoor API
client. It is kept in this repository as a **reference oracle** for the
TypeScript port.

## Status

- ❌ Not maintained
- ❌ Not published to PyPI
- ❌ Not covered by CI
- ✅ Still runnable if you have Python 3.9+ and `requests`
- ✅ Useful for cross-checking TypeScript behavior

## When to use it

- You suspect a TS bug and want a second opinion.
- You want a quick throwaway script without `npm install`.
- You're reading the source to understand an endpoint.

## When NOT to use it

- In production. The TypeScript client is the supported path.
- As a dependency of the MCP server. Never shell out to Python from Node.

## Running

```bash
pip install requests
python sheypoor.py search iran -q "آیفون" -p 3
python sheypoor.py listing --id 466838381