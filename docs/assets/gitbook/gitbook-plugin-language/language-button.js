require(['gitbook'], function(gitbook) {
  gitbook.events.bind('start', function() {

    gitbook.toolbar.createButton({
      id: 'lang-switcher',
      icon: 'fa fa-globe',
      label: 'Language',
      className: 'language-settings',
      position: 'left',
      dropdown: [
        {
          text: 'Català',
          onClick: function() {
            const path = window.location.pathname;
            const updated = path.replace(/\/(ca|en)(\/)?$/, '/ca');
            window.location.href = updated + window.location.hash;
          }
        },
        {
          text: 'English',
          onClick: function() {
            const path = window.location.pathname;
            const updated = path.replace(/\/(ca|en)(\/)?$/, '/en');
            window.location.href = updated + window.location.hash;
          }
        }
      ]
    });

  });
});

