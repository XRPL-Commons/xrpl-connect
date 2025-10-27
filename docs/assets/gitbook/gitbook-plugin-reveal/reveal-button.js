require(['gitbook', 'jquery'], function(gitbook, $) {

    const BUTTON_ID = 'reveal-button';  // ID único para el botón

    gitbook.events.bind('page.change', function(e, config) {
        // Eliminar el botón antes de crear uno nuevo
        gitbook.toolbar.removeButton(BUTTON_ID);
        console.log(`Botón ${BUTTON_ID} eliminado antes de cargar la nueva página.`);

        var currentPage = window.location.pathname.split('/').pop().replace('.html', '');
        console.log("Cambiando de página a:", currentPage);

        // Verificamos si hay diapositivas para la página actual
        if (slidesData.hasOwnProperty(currentPage)) {
            var slideUrl = slidesData[currentPage];

            // Crear el botón Reveal.js solo si existen diapositivas
            gitbook.toolbar.createButton({
                id: BUTTON_ID,  // Asignamos un ID único al botón
                icon: 'fa fa-tv',
                label: 'Ver Diapositivas',
                position: 'left',
                onClick: function(e) {
                    e.preventDefault();
                    window.open(slideUrl, '_blank');
                }
            });

            console.log(`Botón ${BUTTON_ID} creado.`);
        }
    });

});
