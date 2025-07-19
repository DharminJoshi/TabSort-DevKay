name: "\U0001F41E Bug Report"
description: Report something that isn't working as expected
title: "[Bug] <brief description>"
labels: [bug]
body:
  - type: markdown
    attributes:
      value: |
        Thanks for helping improve TabSort-DevKay! Please fill out the form below.

  - type: input
    id: version
    attributes:
      label: Extension Version
      placeholder: "e.g. 1.0.3"
    validations:
      required: true

  - type: dropdown
    id: browser
    attributes:
      label: Browser
      options:
        - Chrome
        - Edge
        - Brave
        - Other
    validations:
      required: true

  - type: textarea
    id: what-happened
    attributes:
      label: What went wrong?
      description: Describe the bug and what you expected to happen.
      placeholder: "When I click group tabs, nothing happens..."
    validations:
      required: true

  - type: textarea
    id: steps
    attributes:
      label: Steps to Reproduce
      description: Please list the steps to reproduce the issue.
      placeholder: |
        1. Open 3 tabs
        2. Select 2 of them
        3. Enter group name
        4. Click "Group Selected Tabs"
        5. Nothing happens

  - type: textarea
    id: logs
    attributes:
      label: Console Logs (if available)
      description: |
        Open the browser DevTools → Console tab → copy any error messages.
      render: shell

  - type: textarea
    id: additional
    attributes:
      label: Additional Info
      description: Any screenshots, video, or system context
