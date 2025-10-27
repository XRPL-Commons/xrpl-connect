require(['gitbook', 'jquery'], function(gitbook, $) {

  const ZIP_BUTTON_ID = 'zip-button';

  gitbook.events.bind('page.change', function(e, config) {
    gitbook.toolbar.removeButton(ZIP_BUTTON_ID);
    console.log(`Botón ${ZIP_BUTTON_ID} eliminado antes de cargar la nueva página.`);

    setTimeout(function () {
      // Buscar el meta tag dins <head>
      var zipMetaTag = $('meta[name="zip-url"]');
      var zipUrl = zipMetaTag.length ? zipMetaTag.attr('content') : null;

      if (zipUrl) {
        console.log(`Meta tag 'zip-url' encontrado con URL: ${zipUrl}`);

        gitbook.toolbar.createButton({
          id: ZIP_BUTTON_ID,
          icon: 'fa fa-download',
          label: 'Descarregar dades',
          position: 'left',
          onClick: function(e) {
            e.preventDefault();
            window.open(zipUrl, '_blank');
          }
        });

        console.log(`Botón ${ZIP_BUTTON_ID} creado.`);
      } else {
        console.log(`No se encontró meta tag 'zip-url' o está vacío. No se creará el botón.`);
      }
    }, 100); // retard per assegurar que el DOM estigui complet
  });

});

