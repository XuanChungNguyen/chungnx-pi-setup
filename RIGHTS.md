# Source provenance and release status

The original repository README says four scripts were adapted from
https://github.com/mrgoonie/zuey-pi-setup without a bundled license. That provenance
must not be silently replaced with a blanket open-source license.

The backup, restore and project entrypoints now delegate to a new Node implementation.
The inherited helper implementations and personal snapshot are absent from the current
tree. Historical Git contents still need owner review if this repository is distributed
with its complete history. Third-party npm packages retain their own licenses.

No blanket LICENSE is added by this change because choosing one is the repository
owner's legal/product decision. Before a public release, the owner must choose a
license for the current template and decide whether to preserve or rewrite historical
commits that contain inherited material. This file records the unresolved release gate.
