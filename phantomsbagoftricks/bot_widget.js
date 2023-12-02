BOT_ANCHOR = document.getElementById('bot-anchor');

// the callback handles the view inside the widget
// this also works when the widget is loaded again after tab switch
BOT_SCRIPT_LOADED_CALLBACK = function() {
    const containerId = document.getElementById('bot-container-id').textContent;
    const actionId = document.getElementById('bot-action-id').textContent;

    if (['activate_artifact_overview', 'add_view'].includes(actionId)) {
        const widgetContainer = document.getElementById('bot-widget');
        if(widgetContainer) {
            const viewName = widgetContainer.getAttribute('viewname');
            const view = BOTViewFactory.createView(viewName, true);
            if(view) {
                widgetContainer.appendChild(view.getElement());
            }
        }
    }
}

if(!BOT_ANCHOR) {
    console.log('BoT load plugin');

    appPath = document.getElementById("bot-app-path").textContent;    
    anchor = document.createElement('div');
    anchor.id = 'bot-anchor';    
    script = document.createElement('script');
    script.id = "bot-script";
    script.setAttribute('type', 'text/javascript');
    script.setAttribute('src', '/app_resource/' + appPath + '/bot_plugin.js');
    anchor.appendChild(script);
    document.body.appendChild(this.anchor);
} else {
    BOT_INSTANCE.checkInstanceAnchor();
    BOT_INSTANCE.itemsController.refresh(false);
    BOT_SCRIPT_LOADED_CALLBACK();
}