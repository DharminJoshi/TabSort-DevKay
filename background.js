let inactiveTabs = {};
let groupMapping = {};
let whitelist = [];
let inactivityTimeoutMinutes = 10; // Default 10 minutes

// --- STORAGE HELPERS ---

function saveGroupMapping() {
  chrome.storage.local.set({ groupMapping });
}

function loadGroupMapping() {
  return new Promise((resolve) => {
    if (Object.keys(groupMapping).length === 0) {
      chrome.storage.local.get('groupMapping', (data) => {
        groupMapping = data.groupMapping || {};
        resolve();
      });
    } else {
      resolve();
    }
  });
}

function saveInactiveTabs() {
  chrome.storage.local.set({ inactiveTabs });
}

function loadInactiveTabs() {
  return new Promise((resolve) => {
    chrome.storage.local.get('inactiveTabs', (data) => {
      inactiveTabs = data.inactiveTabs || {};
      resolve();
    });
  });
}

function loadWhitelist() {
  return new Promise((resolve) => {
    chrome.storage.local.get('whitelist', (data) => {
      whitelist = data.whitelist || [];
      resolve();
    });
  });
}

function loadTimeout() {
  return new Promise((resolve) => {
    chrome.storage.local.get('inactivityTimeoutMinutes', (data) => {
      inactivityTimeoutMinutes = data.inactivityTimeoutMinutes || 10;
      resolve();
    });
  });
}

// --- UTILS ---

function pickColorForGroup(name) {
  const colors = ['blue', 'green', 'red', 'yellow', 'purple', 'pink', 'cyan', 'orange'];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash += name.charCodeAt(i);
  }
  return colors[hash % colors.length];
}

function isWhitelisted(tabUrl) {
  if (!tabUrl) return false;
  return whitelist.some(domain => tabUrl.includes(domain));
}

// --- INACTIVE TABS MANAGEMENT ---

// Check and close tabs inactive longer than timeout, skipping whitelisted
async function checkInactiveTabs() {
  const now = Date.now();

  for (const tabIdStr of Object.keys(inactiveTabs)) {
    const tabId = Number(tabIdStr);
    try {
      const tab = await chrome.tabs.get(tabId);
      if (!tab) {
        // Tab might be already closed
        delete inactiveTabs[tabIdStr];
        continue;
      }

      if (isWhitelisted(tab.url)) {
        // Skip whitelisted tabs
        continue;
      }

      if (now - inactiveTabs[tabIdStr] > inactivityTimeoutMinutes * 60 * 1000) {
        await chrome.tabs.remove(tabId);
        delete inactiveTabs[tabIdStr];
      }
    } catch (e) {
      // Tab might not exist or other errors
      delete inactiveTabs[tabIdStr];
    }
  }

  saveInactiveTabs();
}

// --- EVENT LISTENERS ---

chrome.tabs.onActivated.addListener(activeInfo => {
  inactiveTabs[activeInfo.tabId] = Date.now();
  saveInactiveTabs();
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === 'complete') {
    inactiveTabs[tabId] = Date.now();
    saveInactiveTabs();
  }
});

// --- INITIALIZE STORAGE DATA ---

async function init() {
  await Promise.all([
    loadGroupMapping(),
    loadInactiveTabs(),
    loadWhitelist(),
    loadTimeout()
  ]);
}

init();

// Check inactive tabs every minute
setInterval(checkInactiveTabs, 60 * 1000);

// --- MESSAGE HANDLER ---

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const { action } = message;

  if (action === 'groupTab' || action === 'groupMultipleTabs') {
    loadGroupMapping().then(() => {
      if (action === 'groupTab') {
        const { tabId, groupName } = message;
        if (!groupName || typeof groupName !== 'string') {
          sendResponse({ status: 'error', message: 'Invalid group name' });
          return;
        }

        if (groupMapping[groupName]) {
          chrome.tabs.group({ groupId: groupMapping[groupName], tabIds: [tabId] }, () => {
            if (chrome.runtime.lastError) {
              sendResponse({ status: 'error', message: chrome.runtime.lastError.message });
            } else {
              sendResponse({ status: 'grouped', groupName });
            }
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
              if (chrome.runtime.lastError) {
                sendResponse({ status: 'error', message: chrome.runtime.lastError.message });
              } else {
                sendResponse({ status: 'success', groupedInto: groupName });
              }
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

  if (action === 'closeInactiveTabs') {
    checkInactiveTabs().then(() => {
      sendResponse({ status: 'done', message: 'Checked and closed inactive tabs.' });
    });
    return true;
  }

  if (action === 'getGroups') {
    loadGroupMapping().then(() => {
      sendResponse({ groupMapping });
    });
    return true;
  }

  if (action === 'renameGroup') {
    const { oldGroupName, newGroupName } = message;

    if (!groupMapping[oldGroupName]) {
      sendResponse({ status: 'error', message: 'Original group not found' });
      return;
    }

    const groupId = groupMapping[oldGroupName];

    chrome.tabGroups.update(groupId, { title: newGroupName }, () => {
      delete groupMapping[oldGroupName];
      groupMapping[newGroupName] = groupId;
      saveGroupMapping();
      sendResponse({ status: 'renamed', newGroupName });
    });

    return true;
  }

 if (action === 'deleteGroup') {
  const { groupName } = message;

  if (!groupMapping[groupName]) {
    sendResponse({ status: 'error', message: 'Group not found' });
    return;
  }

  const groupId = groupMapping[groupName];


  chrome.tabs.query({ groupId }, (tabs) => {
    if (chrome.runtime.lastError) {
      sendResponse({ status: 'error', message: chrome.runtime.lastError.message });
      return;
    }

    if (!tabs.length) {
      delete groupMapping[groupName];
      saveGroupMapping();
      sendResponse({ status: 'deleted', deletedGroup: groupName });
      return;
    }

    const tabIds = tabs.map(tab => tab.id);

    chrome.tabs.ungroup(tabIds, () => {
      if (chrome.runtime.lastError) {
        sendResponse({ status: 'error', message: chrome.runtime.lastError.message });
        return;
      }

      delete groupMapping[groupName];
      saveGroupMapping();
      sendResponse({ status: 'deleted', deletedGroup: groupName });
    });
  });

  return true;
}


  if (action === 'getWhitelist') {
    sendResponse({ whitelist });
    return true;
  }

  if (action === 'updateWhitelist') {
    const { newWhitelist } = message;
    if (!Array.isArray(newWhitelist)) {
      sendResponse({ status: 'error', message: 'Invalid whitelist format' });
      return;
    }
    whitelist = newWhitelist;
    chrome.storage.local.set({ whitelist });
    sendResponse({ status: 'success', whitelist });
    return true;
  }

  if (action === 'getTimeout') {
    sendResponse({ inactivityTimeoutMinutes });
    return true;
  }

  if (action === 'setTimeout') {
    const { newTimeout } = message;
    if (typeof newTimeout !== 'number' || newTimeout <= 0) {
      sendResponse({ status: 'error', message: 'Invalid timeout value' });
      return;
    }
    inactivityTimeoutMinutes = newTimeout;
    chrome.storage.local.set({ inactivityTimeoutMinutes: newTimeout });
    sendResponse({ status: 'success', inactivityTimeoutMinutes });
    return true;
  }
});
