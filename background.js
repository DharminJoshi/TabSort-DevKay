let inactiveTabs = {};
let groupMapping = {};

// Save group mapping to local storage
function saveGroupMapping() {
  chrome.storage.local.set({ groupMapping });
}

// Load group mapping from storage if not already loaded
function loadGroupMapping(callback) {
  if (Object.keys(groupMapping).length === 0) {
    chrome.storage.local.get('groupMapping', (data) => {
      groupMapping = data.groupMapping || {};
      callback();
    });
  } else {
    callback();
  }
}

// Automatically close tabs inactive for more than 10 minutes
function checkInactiveTabs() {
  const now = Date.now();
  for (const tabId in inactiveTabs) {
    if (now - inactiveTabs[tabId] > 10 * 60 * 1000) {
      chrome.tabs.remove(Number(tabId));
      delete inactiveTabs[tabId];
    }
  }
}

// Track active tabs
chrome.tabs.onActivated.addListener(activeInfo => {
  inactiveTabs[activeInfo.tabId] = Date.now();
});

// Track updated tabs as active once they finish loading
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === 'complete') {
    inactiveTabs[tabId] = Date.now();
  }
});

// Periodically check for inactive tabs (every 60 seconds)
setInterval(checkInactiveTabs, 60 * 1000);

// Handle messages from popup or content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const { action } = message;

  if (action === 'groupTab' || action === 'groupMultipleTabs') {
    loadGroupMapping(() => {
      if (action === 'groupTab') {
        const { tabId, groupName } = message;

        if (!groupName || typeof groupName !== 'string') {
          sendResponse({ status: 'error', message: 'Invalid group name' });
          return;
        }

        if (groupMapping[groupName]) {
          chrome.tabs.group({ groupId: groupMapping[groupName], tabIds: [tabId] }, () => {
            sendResponse({ status: 'grouped', groupName });
          });
        } else {
          chrome.tabs.group({ tabIds: [tabId] }, (groupId) => {
            if (chrome.runtime.lastError || groupId === undefined) {
              console.error('Group creation error:', chrome.runtime.lastError);
              sendResponse({ status: 'error', message: 'Group creation failed' });
              return;
            }

            chrome.tabGroups.update(groupId, {
              title: groupName,
              color: pickColorForGroup(groupName)
            }, () => {
              groupMapping[groupName] = groupId;
              saveGroupMapping();
              sendResponse({ status: 'created', groupName });
            });
          });
        }
      }

      if (action === 'groupMultipleTabs') {
        const { tabIds, groupName } = message;

        if (!Array.isArray(tabIds) || tabIds.length === 0 || !groupName) {
          sendResponse({ status: 'error', message: 'Invalid input' });
          return;
        }

        chrome.tabs.query({}, allTabs => {
          const validTabIds = allTabs.map(tab => tab.id).filter(id => tabIds.includes(id));

          if (validTabIds.length === 0) {
            sendResponse({ status: 'error', message: 'No valid tabs found' });
            return;
          }

          if (groupMapping[groupName]) {
            chrome.tabs.group({ groupId: groupMapping[groupName], tabIds: validTabIds }, () => {
              sendResponse({ status: 'success', groupedInto: groupName });
            });
          } else {
            chrome.tabs.group({ tabIds: validTabIds }, (groupId) => {
              if (chrome.runtime.lastError || groupId === undefined) {
                console.error('Group creation error:', chrome.runtime.lastError);
                sendResponse({ status: 'error', message: 'Failed to create new group' });
                return;
              }

              chrome.tabGroups.update(groupId, {
                title: groupName,
                color: pickColorForGroup(groupName)
              }, () => {
                groupMapping[groupName] = groupId;
                saveGroupMapping();
                sendResponse({ status: 'success', createdGroup: groupName });
              });
            });
          }
        });
      }
    });

    return true; // Async response
  }

  // Handle manual inactive tab closing
  if (action === 'closeInactiveTabs') {
    checkInactiveTabs();
    sendResponse({ status: 'done', message: 'Checked and closed inactive tabs.' });
  }

  // Return all group mappings
  if (action === 'getGroups') {
    loadGroupMapping(() => {
      sendResponse({ groupMapping });
    });
    return true;
  }

  // Handle renaming group
  if (action === 'renameGroup') {
    const { oldGroupName, newGroupName } = message;

    if (!groupMapping[oldGroupName]) {
      sendResponse({ status: 'error', message: 'Original group not found' });
      return;
    }

    const groupId = groupMapping[oldGroupName];

    // Update group title
    chrome.tabGroups.update(groupId, { title: newGroupName }, () => {
      // Remove old group mapping and add the new one
      delete groupMapping[oldGroupName];
      groupMapping[newGroupName] = groupId;
      saveGroupMapping();
      sendResponse({ status: 'renamed', newGroupName });
    });

    return true;
  }

  // Handle deleting group
  if (action === 'deleteGroup') {
    const { groupName } = message;

    if (!groupMapping[groupName]) {
      sendResponse({ status: 'error', message: 'Group not found' });
      return;
    }

    const groupId = groupMapping[groupName];

    // Remove the group
    chrome.tabGroups.remove(groupId, () => {
      delete groupMapping[groupName];
      saveGroupMapping();
      sendResponse({ status: 'deleted', deletedGroup: groupName });
    });

    return true;
  }
});

// Pick a color for a group name deterministically
function pickColorForGroup(name) {
  const colors = ['blue', 'green', 'red', 'yellow', 'purple', 'pink', 'cyan', 'orange'];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash += name.charCodeAt(i);
  }
  return colors[hash % colors.length];
}
