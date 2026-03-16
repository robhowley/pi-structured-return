# fallback

If no parser or machine-readable mode exists:
- keep the command narrow
- keep the output quiet
- let `structured_return` store the full log
- rely on `tail + logPath` fallback
