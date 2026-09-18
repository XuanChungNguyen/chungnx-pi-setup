# Security policy

This repository handles configuration paths and may operate near credentials,
although credentials are deliberately outside its managed file set.

Report a vulnerability privately through GitHub's **Report a vulnerability**
security-advisory form for this repository. Do not include real tokens, auth files,
session histories or customer data. Use synthetic reproductions.

The current supported line is the latest tagged 0.x release. Before a public tag
exists, `main` is a development candidate and receives no compatibility guarantee.

If a credential may have entered a commit, log, journal or artifact, revoke it at
the provider first. Removing the file from the latest commit does not remove it
from Git history. Journals under `~/.pi-setup/journals` contain prior local bytes;
protect them with the same care as the original configuration.
