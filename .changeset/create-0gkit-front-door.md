---
"create-0gkit-app": minor
---

Make `create-0gkit-app` the working npm-create front door. It now bundles the
scaffolder implementation, exposes the `create-0gkit-app` binary, and replaces
the old defensive shim that redirected to the unavailable `create-0g-app` name.
