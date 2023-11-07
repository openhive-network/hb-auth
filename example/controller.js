// handle tab change
function onTabSelect(event, id) {
    const allTabs = document.querySelectorAll(".tabs ul li");
    allTabs.forEach((tab) => tab.classList.remove('is-active'));
    
    event.parentElement.classList.add('is-active');

    const tabs = document.querySelectorAll('.tab');
    tabs.forEach((tab) => {
      if (tab.id === id) {
        tab.classList.remove('hidden')
      } else {
        tab.classList.add('hidden')
      }
    });
  }
  