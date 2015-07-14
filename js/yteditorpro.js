(function(){
    var active = true;
    var publishRequested = false;
                    
    $("#publish-button").click(function(evt) {
        publishRequested = true; //Leaving the page to publish video
    });
    
    window.onbeforeunload = confirmExit;
    function confirmExit(event) {
        //Don't request confirm if publishing
        if ( publishRequested ) {
            return null;
        }
        
        return "There may be unsaved changes. Do you wish to leave the page?";
    }
    
    jQuery("#page").addClass('promode_active');
    function toggleActive() {
        active = !active;

        if ( active ) {
            jQuery("#page").addClass('promode_active');
        } else {
            jQuery("#page").removeClass('promode_active');
        }
    }
    
    //Deactivate hotkeys when focused in text inputs
    jQuery("input[type*=text], textarea").focus(function(evt){
       toggleActive(); 
    });
    jQuery("input[type*=text], textarea").blur(function(evt){
        toggleActive();
    });
    
    //Modal Help Screen
    $("body").append('<div id="yteditorpro_help" class="modal fade">' +
      '<div class="modal-dialog">' +
        '<div class="modal-content">' +
          '<div class="modal-header">' +
            '<button type="button" class="close" data-dismiss="modal" aria-label="Close"><span aria-hidden="true">&times;</span></button>' +
            '<h4 class="modal-title"><b>Pro Mode for Youtube Video Editor - Help</b></h4>' +
          '</div>' +
          '<div class="modal-body">' +
            '<table class="help">' +
                '<tr><td>' + 'H</td><td>Show / Hide this help screen' + '</td></tr>' +
                '<tr><td>' + 'CTRL-A</td><td>Toggle pro mode hotkeys on/off' + '</td></tr>' +
                '<tr><td>' + 'S</td><td>Sort photos alphabetically on the images tab' + '</td></tr>' +
                '<tr><td>' + 'C</td><td>Close the currently selected clip' + '</td></tr>' +
                '<tr><td>' + 'K</td><td>Toggle Pan / Zoom effect on currently selected clip' + '</td></tr>' +
                '<tr><td>' + '+</td><td>Increase currently selected clip by 1 second' + '</td></tr>' +
                '<tr><td>' + '-</td><td>Decrease currently selected clip by 1 second' + '</td></tr>' +
                '<tr><td>' + 'P</td><td>Scroll timeline to currently selected clip' + '</td></tr>' +
                '<tr><td>' + '[</td><td>Scroll timeline to first clip' + '</td></tr>' +
                '<tr><td>' + ']</td><td>Scroll timeline to last clip' + '</td></tr>' +
                '<tr><td>' + '1</td><td>Video clip tab' + '</td></tr>' +
                '<tr><td>' + '2</td><td>Copyright tab' + '</td></tr>' +
                '<tr><td>' + '3</td><td>Photos tab' + '</td></tr>' +
                '<tr><td>' + '4</td><td>Audio tab' + '</td></tr>' +
                '<tr><td>' + '5</td><td>Transitions tab' + '</td></tr>' +
                '<tr><td>' + '6</td><td>Text tab' + '</td></tr>' +
            '</table>' +
          '</div>' +
        '</div>' +
      '</div>' +
    '</div>');
    $("#yteditorpro_help").modal({'show':false});
    
    /* center modal - http://www.minimit.com/articles/solutions-tutorials/vertical-center-bootstrap-3-modals */
    function centerModals(){
      $('.modal').each(function(i){
        var $clone = $(this).clone().css('display', 'block').appendTo('body');
        var top = Math.round(($clone.height() - $clone.find('.modal-content').height()) / 2);
        top = top > 0 ? top : 0;
        $clone.remove();
        $(this).find('.modal-content').css("margin-top", top);
      });
    }
    $('.modal').on('show.bs.modal', centerModals);
    $(window).on('resize', centerModals);
    
    //Hotkeys
    jQuery(document).keypress(
        function(event) {
            if ( event.which == 1 ) { //CTRL-A
                toggleActive();
            }

            if ( active ) {
                if ( event.which == 99 ) { //C - Close current window
                    jQuery(".close-button")[0].click();
                    jQuery(".close-button")[1].click();
                } else if ( event.which == 32 ) { //Spacebar - Pause/Play video
                    event.preventDefault();
                    var player = jQuery("#preview-swf")[0];

                    if (player.getPlayerState() == 1) {
                        player.pauseVideo();
                    } else {
                        player.playVideo();
                    }
                } else if ( event.which == 115 ) { //S - sort thumbnails
                    if ( jQuery("#images-tab").attr('class').indexOf('selected') != -1 ) {
                        var parent = jQuery(jQuery(".image-original")[0]).parent();
                        var images = jQuery(".image-original").detach();
                        images.sort(function(a,b){
                            var urlA = jQuery(a).find("img").css('background-image');
                            urlA = urlA.substring(urlA.lastIndexOf('/')+1);
                            var urlB = jQuery(b).find("img").css('background-image');
                            urlB = urlB.substring(urlB.lastIndexOf('/')+1);
                            return urlA.localeCompare(urlB);
                        });
                        images.appendTo(parent);
                    }
                } else if ( event.which == 107) { //K - ken burns effect
                    jQuery("input[effectid*='KEN_BURNS']").click();
                } else if ( event.which == 43) { //+ key increase by one second selected clip
                    jQuery(".right-trimmer").each(function(idx,val) {
                        var target = jQuery(val);
                        if (target.css("visibility") == "visible") {
                            for ( var i = 0; i < 15; i++ ) {
                                target.find(".nudge-right").click();
                            }                                
                        }
                    });
                } else if ( event.which == 45) { //- key decrease by one second selected clip
                    jQuery(".right-trimmer").each(function(idx,val) {
                        var target = jQuery(val);
                        if (target.css("visibility") == "visible") {
                            for ( var i = 0; i < 15; i++ ) {
                                target.find(".nudge-left").click();
                            }
                        }
                    });
                } else if ( event.which == 49) { //1 - video tab
                    if (jQuery("#mediapicker-infobox").attr('class') == "infobox-visible") {
                        jQuery("#mediapicker-infobox").toggleClass("mediapicker-visible");
                        jQuery("#mediapicker-infobox").toggleClass("infobox-visible");
                    }
                    jQuery("#video-tab").click();
                } else if ( event.which == 50) { //2 - copyright tab
                    if (jQuery("#mediapicker-infobox").attr('class') == "infobox-visible") {
                        jQuery("#mediapicker-infobox").toggleClass("mediapicker-visible");
                        jQuery("#mediapicker-infobox").toggleClass("infobox-visible");
                    }
                    jQuery("#cc-tab").click();                    
                } else if ( event.which == 51) { //3 images tab
                    if (jQuery("#mediapicker-infobox").attr('class') == "infobox-visible") {
                        jQuery("#mediapicker-infobox").toggleClass("mediapicker-visible");
                        jQuery("#mediapicker-infobox").toggleClass("infobox-visible");
                    }
                    jQuery("#images-tab").click();
                } else if ( event.which == 52) { //4 audio tab
                    if (jQuery("#mediapicker-infobox").attr('class') == "infobox-visible") {
                        jQuery("#mediapicker-infobox").toggleClass("mediapicker-visible");
                        jQuery("#mediapicker-infobox").toggleClass("infobox-visible");
                    }
                    jQuery("#audio-tab").click();
                } else if ( event.which == 53) { //5 transitions tab
                    if (jQuery("#mediapicker-infobox").attr('class') == "infobox-visible") {
                        jQuery("#mediapicker-infobox").toggleClass("mediapicker-visible");
                        jQuery("#mediapicker-infobox").toggleClass("infobox-visible");
                    }
                    jQuery("#transition-tab").click();
                } else if ( event.which == 54) { //6 text tab
                    if (jQuery("#mediapicker-infobox").attr('class') == "infobox-visible") {
                        jQuery("#mediapicker-infobox").toggleClass("mediapicker-visible");
                        jQuery("#mediapicker-infobox").toggleClass("infobox-visible");
                    }
                    jQuery("#text-tab").click();
                } else if ( event.which == 112 ) { //P - focus current clip
                    var offset = jQuery(".timeline-video-clips").children(".selected").css('left');
                    jQuery(".editor-timeline").scrollLeft(offset.substring(0,offset.lastIndexOf("px")));
                } else if ( event.which == 91 ) { // [ - focus start
                    jQuery(".editor-timeline").scrollLeft(0);
                } else if ( event.which == 93 ) { // ] - focus end
                    var offset = jQuery(".timeline-video-clips").children().last().css('left');
                    jQuery(".editor-timeline").scrollLeft(offset.substring(0,offset.lastIndexOf("px")));
                } else if ( event.which == 104 ) { // H - show help
                    $("#yteditorpro_help").modal('toggle');
                }
            } 
        }
    );
})();