document.addEventListener('DOMContentLoaded', () => {
  const tabsList = document.getElementById('tabsList');
  const groupNameInput = document.getElementById('groupNameInput');
  const groupSelectedTabsButton = document.getElementById('groupSelectedTabs');
  const closeInactiveTabsButton = document.getElementById('closeInactiveTabs');
  const groupsList = document.getElementById('groupsList');

  // Load and display tabs
  function loadTabs() {
    chrome.tabs.query({}, (tabs) => {
      tabsList.innerHTML = ''; // Clear existing tabs

      tabs.forEach(tab => {
        const tabItem = document.createElement('div');
        tabItem.classList.add('tab-item');

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = `tab-${tab.id}`;
        checkbox.value = tab.id;

        const label = document.createElement('label');
        label.setAttribute('for', checkbox.id);
        label.textContent = tab.title;

        tabItem.appendChild(checkbox);
        tabItem.appendChild(label);
        tabsList.appendChild(tabItem);
      });
    });
  }

  // Load and display existing groups
  function loadGroups() {
    chrome.runtime.sendMessage({ action: 'getGroups' }, (response) => {
      groupsList.innerHTML = ''; // Clear current groups

      const mapping = response?.groupMapping || {};

      Object.keys(mapping).forEach(groupName => {
        const groupItem = document.createElement('div');
        groupItem.classList.add('group-item');

        const titleDiv = document.createElement('div');
        titleDiv.textContent = groupName;

        const actionsDiv = document.createElement('div');

        // Rename
        const renameButton = document.createElement('button');
        renameButton.textContent = 'Rename';
        renameButton.classList.add('rename-button');
        renameButton.addEventListener('click', () => {
          const newName = prompt('Enter new name for the group:', groupName);
          if (!newName || newName.trim() === '') return;

          chrome.runtime.sendMessage({
            action: 'renameGroup',
            oldGroupName: groupName,
            newGroupName: newName.trim()
          }, (res) => {
            if (res?.status === 'renamed') {
              alert('Group renamed.');
              loadGroups(); // Reload groups after renaming
            } else {
              alert('Rename failed.');
            }
          });
        });

        // Delete
        const deleteButton = document.createElement('button');
        deleteButton.textContent = 'Delete';
        deleteButton.classList.add('delete-button');
        deleteButton.addEventListener('click', () => {
          const confirmDelete = confirm(`Delete group "${groupName}"?`);
          if (!confirmDelete) return;

          chrome.runtime.sendMessage({
            action: 'deleteGroup',
            groupName
          }, (res) => {
            if (res?.status === 'deleted') {
              alert('Group deleted.');
              loadGroups(); // Reload groups after deletion
            } else {
              alert('Delete failed.');
            }
          });
        });

        actionsDiv.appendChild(renameButton);
        actionsDiv.appendChild(deleteButton);

        groupItem.appendChild(titleDiv);
        groupItem.appendChild(actionsDiv);
        groupsList.appendChild(groupItem);
      });
    });
  }

  // Group selected tabs
  groupSelectedTabsButton.addEventListener('click', () => {
    const selectedTabIds = Array.from(
      document.querySelectorAll('#tabsList input[type="checkbox"]:checked')
    ).map(cb => parseInt(cb.value));

    const groupName = groupNameInput.value.trim();

    if (selectedTabIds.length === 0) {
      alert('Select at least one tab.');
      return;
    }

    if (!groupName) {
      alert('Enter a group name.');
      return;
    }

    chrome.runtime.sendMessage({
      action: 'groupMultipleTabs',
      tabIds: selectedTabIds,
      groupName
    }, (response) => {
      if (response?.status === 'success') {
        alert(`Grouped into: ${groupName}`);
        groupNameInput.value = ''; // Clear input after successful group
        loadGroups(); // Reload groups after grouping
      } else {
        alert('Failed to group tabs.');
      }
    });
  });

  // Close inactive tabs
  closeInactiveTabsButton.addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'closeInactiveTabs' }, () => {
      alert('Inactive tabs closed.');
    });
  });

  // Initial load
  loadTabs();
  loadGroups();
});
