require(['gitbook', 'jquery'], function(gitbook, $) {

    const VIDEO_BUTTON_ID = 'video-button';  // ID único para el botón del vídeo

    gitbook.events.bind('page.change', function(e, config) {
        // Eliminar el botón de vídeo antes de crear uno nuevo
        gitbook.toolbar.removeButton(VIDEO_BUTTON_ID);
        console.log(`Botón ${VIDEO_BUTTON_ID} eliminado antes de cargar la nueva página.`);

        // Verificar si hay un meta tag con la URL del video
        var videoMetaTag = $('meta[name="video-url"]');
        var videoUrl = videoMetaTag.length ? videoMetaTag.attr('content') : null;

        if (videoMetaTag.length > 0 && videoUrl) {
            console.log(`Meta tag 'video-url' encontrado con URL: ${videoUrl}`);

            // Crear el botón de video solo si el meta tag tiene contenido válido
            gitbook.toolbar.createButton({
                id: VIDEO_BUTTON_ID,
                icon: 'fa fa-play-circle',  // Icono de reproducción
                label: 'Ver Vídeo',
                position: 'left',
                onClick: function(e) {
                    e.preventDefault();
                    window.open(videoUrl, '_blank');
                }
            });

            console.log(`Botón ${VIDEO_BUTTON_ID} creado para el capítulo actual.`);
        } else {
            console.log(`No se encontró meta tag 'video-url' o está vacío. No se creará el botón.`);
        }
    });

});
