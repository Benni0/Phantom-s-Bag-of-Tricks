class PhantomClient {

    static getArtifacts(containerId) {
        var url = "/rest/artifact?_filter_container__in=[" + containerId + "]&page_size=0&pretty";
        return PhantomClient.requestData(url);
    }

    static getCSRFToken(){
        const xsrfCookies = document.cookie.split(';')
            .map(c => c.trim())
            .filter(c => c.startsWith('csrftoken='));
        return decodeURIComponent(xsrfCookies[0].split('=')[1]);
    }

    static requestData(url) {
     const config = {
            method: "GET",
            headers: {
                'Content-Type': 'application/json, text/plain, */*', 
                'X-CSRFToken': PhantomClient.getCSRFToken()
            }
        };
        return fetch(url, config);
    }

    static postData(url, data) {
        const config = {
            method: "POST",
            headers: {
                'Content-Type': 'application/json, text/plain, */*', 
                'X-CSRFToken': PhantomClient.getCSRFToken()
            },
            body: JSON.stringify(data)
        };
        return fetch(url, config);
    }

    static getRunData(runId) {
        const url = '/rest/app_run/' + runId + '/action_result';
        return PhantomClient.requestData(url);
    }

    static async awaitResult(prom) {
        return (await (prom.then((res) => res.json()))).data
    }

    static async executePlaybook(button, viewBody) {
        var bot_values = viewBody.querySelectorAll(".bot-value");
        var values = null;
        for (var item of bot_values) {
            if(!values) {
                values = {};
            }
            var value = BOTGenericView.getData(item);            
            values[item.getAttribute('playbookinput')] = value;
        }

        const playbookId = button.getAttribute("soar-playbook-id");
        var playbookScope = button.getAttribute("soar-playbook-scope");
        if (playbookScope !== "all" && playbookScope !== "new") {
            playbookScope = JSON.parse(playbookScope);
        }

        const body = {
            'container_id': BOT_INSTANCE.containerId,
            'playbook_id': playbookId,
            'run': true,
            'scope': playbookScope
        };

        if(values) {
            if (button.hasAttribute('pack-input'))
            {
                const inputName = button.getAttribute('pack-input');
                body['inputs'] = {};
                body['inputs'][inputName] = values;
            } else {
                body['inputs'] = values;
            }
        }

        const result = PhantomClient.postData('/rest/playbook_run', [body]);

        result
            .then(response=>response.json())
            .then(data=>{
                var text = '';
                if (data[0].failed) {
                    text = 'ERROR: ' + data[0].message;
                }
                if (data[0].recieved) {
                    text = 'Playbook executed with run id: ' + data[0].playbook_run_id;
                }
                (new BOTPopUp(text, 'fa-play', null)).show();
            })      
            .catch(error=>{
                alert(error);
            });
    }
} 

class BOTView{
    constructor(viewName) {
        this.viewName = viewName;
        this.removed = false;
        this.runId = 0;
    }

    updateView(runId, data) {
        if (runId > this.runId) {
            this.removed = false;
            this.runId = runId;
            this.data = data;
        }
    }

    removeView(runId){
        if (runId > this.runId) {
            this.removed = true;
            this.runId = runId;
        }
    }
}

class BOTPlaybook{
    constructor(playbook) {
        this.playbook = playbook;
        this.removed = false;
        this.runId = 0;
    }

    updatePlaybook(runId, scope, sidebar) {
        if (runId > this.runId) {
            this.removed = false;
            this.runId = runId;
            this.scope = scope;
            this.sidebar = sidebar;
        }
    }

    removePlaybook(runId) {
        if (runId > this.runId) {
            this.removed = true;
            this.runId = runId;
        }
    }
}

/*
Controllers
*/

class BOTItemsController{
    constructor(appName) { 
        this.appName = appName;
        this.eventId = null;
    }

    changeEvent(eventId) {
        if(this.eventId != eventId) {
            this.eventId = eventId;
            this.views = {};
            this.playbooks = {};
            this.processedActionIds = [];
            this.refresh(true);
        }
    }

    addView(viewName, runId, data) {
        if(!(viewName in this.views)) {
            this.views[viewName] = new BOTView(viewName);
        }
        if(this.views[viewName].runId < runId) {
            this.views[viewName].updateView(runId, data);

            
            /*PhantomClient.awaitResult(
                PhantomClient.getRunData(runId)).then((action) => {
                    this.views[viewName].updateView(runId, action[0].data[0]);
            });*/
        }
    }

    reloadView(viewName, runId){
        if(viewName in this.views) {
            this.views[viewName].runId = runId;
        }
    }

    removeView(viewName, runId) {
        if(!(viewName in this.views)) {
            this.views[viewName] = new BOTView(viewName);
        }
        if(this.views[viewName].runId < runId) {
            this.views[viewName].removeView(runId);
        }
    }

    addPlaybook(playbookName, runId, scope, sidebar) {
        if(!(playbookName in this.playbooks)) {
            this.playbooks[playbookName] = new BOTPlaybook(playbookName);
        }
        if(this.playbooks[playbookName].runId < runId) {
            this.playbooks[playbookName].updatePlaybook(runId, scope, sidebar);
        }
    }

    removePlaybook(playbookName, runId) {
        if(!(playbookName in this.playbooks)) {
            this.playbooks[playbookName] = new BOTPlaybook(playbookName);
        }
        if(this.playbooks[playbookName].runId < runId) {
            this.playbooks[playbookName].removePlaybook(runId);
        }
        
    }

    getViewByName(viewName) {
        if(viewName in this.views) {
            return this.views[viewName];
        }
    }    

    getViewsForDropdownMenu() {
        const result = [];
        for(const [viewName, view] of Object.entries(this.views)) {
            if (!view.removed && view.data.dropdown_menu) {
                result.push(viewName);
            }
        }
        return result;
    }

    getPlaybooksForDropdownMenu() {
        const result = [];
        for(const [playbookName, playbook] of Object.entries(this.playbooks)) {
            if(!playbook.removed) {
                result.push(playbook);
            }
        }
        return result;
    }

    getViewsForSidebar() {
        const result = [];
        for(const [viewName, view] of Object.entries(this.views)) {
            if (!view.removed && view.data.sidebar) {
                result.push(view);
            }
        }
        return result;
    }

    getPlaybooksForSidebar() {
        const result = [];
        for(const [playbookName, playbook] of Object.entries(this.playbooks)) {
            if(!playbook.removed && playbook.sidebar) {
                result.push(playbook);
            }
        }
        return result;
    }

    refresh(initial) {
        const url = '/rest/app_run?page_size=0&_filter_container=' + this.eventId + '&_filter_app_name="' + this.appName +  '"';
        PhantomClient.awaitResult(PhantomClient.requestData(url)).then((actions) => {
            //const rexViewName = /\"view_name\":.?\"([^"]*)\"/
            const rexJsonParams = /({.*})/;            
            
            for (var action of actions) {
                try{
                    const jsonData = JSON.parse(action.message.match(rexJsonParams)[0]);
                    for(const property in jsonData) {
                        if (typeof jsonData[property] === 'string'){
                            if (jsonData[property].startsWith('[') || jsonData[property].startsWith('{')) {
                                const propval = jsonData[property]
                                    .replaceAll('\\', '')
                                    .replaceAll('"[', '[')
                                    .replaceAll(']"', ']')
                                    .replaceAll('}"', '}')
                                    .replaceAll('"{', "{");
                                jsonData[property] = JSON.parse(propval);
                            }
                        }
                    }

                    const parameters = jsonData;//JSON.parse(jsonParams);

                    if(action.status === "success" && !this.processedActionIds.includes(action.id)) {
                        this.processedActionIds.push(action.id);
                        var popUpView = null;
                        switch(action.action) {
                            case 'activate artifact overview':
                                var viewName = "Artifact overview";
                                popUpView = viewName;
                                this.addView(viewName, action.id, parameters);
                                break;
                            case 'deactivate artifact overview':
                                var viewName = "Artifact overview";
                                this.removeView(viewName, action.id);
                                break;
                            case 'add view':
                                var viewName = parameters.view_name;
                                popUpView = viewName;
                                this.addView(viewName, action.id, parameters);
                                break;
                            case 'remove view':
                                var viewName = parameters.view_name;
                                this.removeView(viewName, action.id);
                                break;
                            case 'reload view':
                                if(!initial) {
                                    var viewName = parameters.view_name;
                                    popUpView = viewName;
                                    this.reloadView(viewName, action.id);
                                }
                                break;
                            case 'add playbooks':
                                popUpView = 'Playbooks'
                                for (var playbook of parameters.playbooks) {
                                    if(playbook.includes('/')) {
                                        this.addPlaybook(playbook, action.id, parameters.scope, parameters.sidebar);
                                    } else {console.log('Playbook must be specified as "repository/playbook_name, not as ' + playbook);}
                                }
                                break;
                            case 'remove playbooks':
                                for (var playbook of parameters.playbooks) {
                                    this.removePlaybook(playbook, action.id);
                                }
                                break;
                        }
                        if (parameters.popup_text && (parameters.enforce_popup || !initial)) {
                            var faIcon = 'fa-play';
                            if (parameters.fa_icon) {
                                faIcon = parameters.fa_icon;
                            }

                            (new BOTPopUp(parameters.popup_text, faIcon, popUpView)).show();
                        }
                        BOT_INSTANCE.refresh();                        
                    }
                }catch(error) {
                    console.log("BoT unable to parse input");
                    console.log(error);
                    console.log(action);
                }
            }
            BOT_SCRIPT_LOADED_CALLBACK();
        });
    }
}


/*
  Display Elements
*/
class BOTButton {
    constructor(appInstance) {        
        this.appInstance = appInstance;
        this.contextMenu = null;
        //this.createButton();
     }

     createButton() {
        this.button = document.createElement('button');
        this.button.id = 'bot-menu';
        this.button.classList.add(
             'btn-icon', 
             'btn--plain', 
             'c-IncidentHeader__button', 
             'c-IncidentHeader__button--icon');
        this.button.setAttribute('type', 'button');
        this.button.setAttribute('display-visible', 'false');
        const img = document.createElement('img');
        img.setAttribute('src', this.appInstance.appLogo);
        img.setAttribute('boarder', 0);
        img.setAttribute('alt', 'BoT');
        img.setAttribute('width', '100%');
        img.setAttribute('height', '100%');
        this.button.appendChild(img);

         const moreMenuButton = document.getElementsByClassName('c-IncidentHeader__MoreMenu')[0];

         //put the button into a div
         this.button_div = document.createElement('div');
         this.button_div.id = 'bot-menu-div';
         this.button_div.appendChild(this.button);
         
         moreMenuButton.parentNode.insertBefore(this.button_div, moreMenuButton.nextSibling);
         this.button.onclick = (e) => {
            e.preventDefault();
            this.toggleContextMenu();
         };
         this.button.oncontextmenu = (e) => {
            e.preventDefault();
            this.toggleSidebar();
         };
     }

     toggleSidebar() {
        if(this.appInstance.sidebar) {
            // Do not refresh here
            //this.appInstance.itemsController.refresh();
            this.appInstance.sidebar.toggleSidebarVisibility();
        }
     }

     toggleContextMenu() {
        if(!this.contextMenu) {
            // context menu can be a property of the button, because it is recreated each time when it's displayed
            this.contextMenu = new BOTContextMenu(this, this.appInstance);
        }
        this.contextMenu.toggleContextMenuVisibility();
     }
}

class BOTPopUp {
    constructor(text, faIcon, viewName) {
        this.text = text;
        this.faIcon = faIcon;
        this.duration = BOT_INSTANCE.config.popup_duration;
        this.viewName = viewName;
        this.timer = null;
    }

    show() {
        const reactMessenger = document.getElementsByClassName('react-messenger')[0];


        this.popUp = document.createElement('li');
        this.popUp.classList.add('react-messenger-slot');
        this.popUp.setAttribute('role', 'alert');
        
        const reactMessengerMessage = document.createElement('div');
        reactMessengerMessage.classList.add('react-messenger-message', 'has-icon', 'full-width', 'truncate-body');
        reactMessengerMessage.setAttribute('role', 'button');
        reactMessengerMessage.setAttribute('tabindex', '-1');

        const reactMessengerMessageInner = document.createElement('div');
        reactMessengerMessageInner.classList.add('react-messenger-message-inner');

        const messageIcon = document.createElement('div');
        messageIcon.classList.add('message-icon');

        const icon = document.createElement('i');
        icon.classList.add('fa', this.faIcon, 'fa-fw');

        const messageBody = document.createElement('div');
        messageBody.classList.add('message-body');

        const messageText = document.createElement('div');
        messageText.classList.add('message-text');
        messageText.innerText = this.text;

        this.popUp.appendChild(reactMessengerMessage);
        reactMessengerMessage.appendChild(reactMessengerMessageInner);
        reactMessengerMessageInner.appendChild(messageIcon);
        messageIcon.appendChild(icon);

        reactMessengerMessageInner.appendChild(messageBody);
        messageBody.appendChild(messageText);
        reactMessenger.appendChild(this.popUp);
        this.startTimer();

        reactMessengerMessage.onclick = () => {
            this.stopTimer();
            if (this.viewName) {
                BOT_INSTANCE.showOverlay(this.viewName);
            }
            this.remove();
        }
    }

    startTimer() {        
        this.timer = setTimeout(() => {
            this.remove();
        }, this.duration * 1000);
    }

    stopTimer() {
        if(this.timer !== null) {
            clearTimeout(this.timer);
        }
    }

    remove() {
        this.popUp.remove();
    }
}

class BOTContextMenu{
    constructor(botButton, appInstance) {
        this.botButton = botButton;
        this.appInstance = appInstance;
        this.display = false;
    }

    updatePosition() {
        this.contextMenu.setAttribute('style', 'position: absolute; will-change: transform; top: 0px; left: 0px; transform: translate3d(' + 
        (this.botButton.button.offsetLeft + this.botButton.button.offsetWidth - this.contextMenu.offsetWidth) +'px, '
        + (this.botButton.button.offsetHeight + this.botButton.button.offsetTop) +'px, 0px)');
    }

    show() {
        this.display = true;
        this.contextMenu = document.createElement('ul');
        this.contextMenu.classList.add('c-MoreMenu__list', 'dropdown-menu', 'show');
        this.contextMenu.setAttribute('role', 'menu');
        this.contextMenu.setAttribute('x-placement', 'bottom-end');

        for(const viewName of this.appInstance.itemsController.getViewsForDropdownMenu()) {
            this.contextMenu.appendChild(
                this.createEntry('fa-pencil-square-o', viewName, function() {
                    BOT_INSTANCE.showOverlay(viewName);
                })
            );
        }

        for(const playbook of this.appInstance.itemsController.getPlaybooksForDropdownMenu()) {
            this.contextMenu.appendChild(
                // TODO: change function to something meaningful
                this.createPlaybookEntry('fa-play', playbook.playbook, playbook.scope)
            );
        }

        document.getElementById('bot-menu-div').appendChild(this.contextMenu);
        this.updatePosition();
        window.addEventListener("resize", () => this.updatePosition());
    }

    createEntry(icon, name, action) {
        const li = document.createElement('li');
        const button = document.createElement('button');
        button.classList.add('c-MoreMenu__list-btn');
        button.innerHTML = '<i class="fa ' + icon + ' fa-fw"></i>' + name;
        button.onclick = (e) => {
            e.preventDefault();
            this.botButton.toggleContextMenu();
            action();
        }
        li.appendChild(button);
        return li;
    }

    createPlaybookEntry(icon, playbook, scope) {
        const li = document.createElement('li');
        const button = document.createElement('button');
        button.classList.add('c-MoreMenu__list-btn');
        button.innerHTML = '<i class="fa ' + icon + ' fa-fw"></i>' + playbook.split('/')[1].replaceAll('_', ' ').toUpperCase();
        button.setAttribute('soar-playbook-id', playbook);
        button.setAttribute('soar-playbook-scope', scope);
        button.onclick = (e) => {
            e.preventDefault();
            this.botButton.toggleContextMenu();
            PhantomClient.executePlaybook(button, li);
        }
        li.appendChild(button);
        return li;
    }

    hide() {
        this.display = false;
        this.contextMenu.remove();
    }

    toggleContextMenuVisibility() {
        if(this.display) {
            this.hide();
        } else {
            this.show();
        }
    }
}

/*
  ViewContainers
*/
class BOTSidebar{
    constructor() {
        this.sidebarBody = null;
        this.sidebar = this.createSidebar();
        this.timer = null;
        this.views = null;
        this.playbooksView = null;
        this.reset();
    }

    reset() {
        this.views = {};
        this.sidebarBody.innerHTML = '';
        this.playbooksView = null;
        if(!document.body.contains(this.sidebar)) {
            document.getElementsByClassName('mc-content-wrapper')[0].appendChild(this.sidebar);
        }
    }

    refresh() {
        const views = BOT_INSTANCE.itemsController.getViewsForSidebar();
        const playbooks = BOT_INSTANCE.itemsController.getPlaybooksForSidebar();

        // add playbook view
        if (this.playbooksView) {
            this.playbooksView.refresh();
        }else {
            if (playbooks.length > 0) {
                this.playbooksView = BOTViewFactory.createView('Playbooks', true);
                this.sidebarBody.appendChild(this.playbooksView.getElement());
            }
        }        

        for (const view of views) {
            if(view.viewName in this.views) {
                if (this.views[view.viewName].runId < view.runId) {
                    this.views[view.viewName].refresh();
                }
            } else {
                const newView = BOTViewFactory.createView(view.viewName, true);
                if(newView) {
                    this.views[view.viewName] = newView;
                    this.sidebarBody.appendChild(newView.getElement());
                }
            }
        }
        // get rid of removed views
        for (const [viewName, viewItem] of Object.entries(this.views)) {
            if (viewItem.view.removed || !viewItem.view.data.sidebar) {
                viewItem.remove();
                delete this.views[viewName];
            }
        }
    }

    updateHeight() {
        this.sidebar.setAttribute('style', "height: " + (window.innerHeight - (this.sidebar.offsetTop - window.scrollY) - 60) + "px;");
    }

    createSidebar() {
        const sidebar = document.createElement('div');
        sidebar.id = 'bot-sidebar'
        sidebar.setAttribute('hidden', 'true');
        document.getElementsByClassName('mc-content-wrapper')[0].appendChild(sidebar);
        
        // sidebar title
        const titleDiv = document.createElement('div');
        titleDiv.classList.add('sidebar-title');
        const sidebarTitle = document.createElement('span');
        sidebarTitle.innerText = "Phantom's Bag of Tricks";
        titleDiv.appendChild(sidebarTitle);
        sidebar.appendChild(titleDiv);

        //sidebar body
        const body = document.createElement('div');
        body.classList.add('sidebar-body');
        sidebar.appendChild(body);
        this.sidebarBody = body;

        //sidebar refresh button
        const refreshButton = document.createElement('i');
        refreshButton.classList.add('fa', 'fa-rotate-right');
        refreshButton.setAttribute('role', 'button');
        refreshButton.setAttribute('style', 'margin: 8px; font-size: 20px; cursor: pointer; float: right;');
        refreshButton.onclick = () => BOT_INSTANCE.itemsController.refresh();
        titleDiv.appendChild(refreshButton);


        //resizing - hacky
        sidebar.addEventListener('scroll', () => {
            if(this.timer !== null) {
                clearTimeout(this.timer);
            }
            this.timer = setTimeout(() => {
                this.updateHeight();
            }, 150);
        }, false);
        window.addEventListener("resize", () => this.updateHeight());
        
        return sidebar;
    }

    toggleSidebarVisibility() {        
        if(this.sidebar.getAttribute('hidden')) {
            this.refresh();
            this.sidebar.removeAttribute('hidden');
            this.updateHeight();
        } else {
            this.sidebar.setAttribute('hidden', 'true');
        }
        // for rearangement of widgets
        window.dispatchEvent(new Event('resize'));
    }
}

class BOTOverlayForm{
    constructor(viewName) {
        this.viewName = viewName;
        this.view = null;
        this.runId = 0;
        this.body = null;
    } 

    showOverlay() {
        const view = BOT_INSTANCE.itemsController.getViewByName(this.viewName);
        if (view.removed) {
            return;
        }

        if (view.runId <= this.runId) {
            return;
        }

        this.runId = view.runId;

        this.view = BOTViewFactory.createView(view.viewName, false);
        if(!this.view) {
           return;
        }

        const backdrop = document.createElement('div');
        backdrop.classList.add('fade', 'modal-backdrop', 'show');

        const formOverlay = document.createElement('div');
        formOverlay.classList.add('fade', 'phantom-modal', 'notifications-modal', 'modal', 'show');
        formOverlay.setAttribute('role', 'dialog');
        formOverlay.setAttribute('tabindex', '-1');
        formOverlay.setAttribute('style', 'display: block;');

        const modalDialog = document.createElement('div');
        modalDialog.classList.add('modal-dialog');

        const modalContent = document.createElement('div');
        modalContent.classList.add('modal-content');        

        const modalHeader = document.createElement('div');
        modalHeader.classList.add('modal-header');

        const titleBox = document.createElement('div');

        const title = document.createElement('h14');
        title.classList.add('modal-title');
        title.innerText = this.viewName;

        const refreshButton = document.createElement('i');
        refreshButton.classList.add('fa', 'fa-rotate-right');
        refreshButton.setAttribute('role', 'button');
        refreshButton.setAttribute('style', 'margin: 8px; font-size: 20px; cursor: pointer;');
        refreshButton.onclick = () => this.refresh();


        titleBox.appendChild(title);
        titleBox.appendChild(refreshButton);

        const closeButton = document.createElement('button');
        closeButton.classList.add('close');
        closeButton.setAttribute('type', 'button');
        closeButton.innerHTML = '<span area-hidden="true">x</span><span class="sr-only>Close</span>';
        closeButton.onclick = (e) => {
            e.preventDefault();
            this.remove();
            BOT_INSTANCE.overlay = null;
         };

        this.modalBody = document.createElement('div');
        this.modalBody.classList.add('modal-body');
        this.modalBody.setAttribute('style', 'max-height: ' + (screen.height * 0.75) + 'px; overflow-y: scroll;');
        
        this.modalBody.appendChild(this.view.getElement());
        
        modalHeader.appendChild(titleBox);
        modalHeader.appendChild(closeButton);
        modalContent.appendChild(modalHeader);
        modalContent.appendChild(this.modalBody);
        modalDialog.appendChild(modalContent);
        formOverlay.appendChild(modalDialog);
        document.getElementsByTagName('body')[0].appendChild(backdrop);
        document.getElementsByTagName('body')[0].appendChild(formOverlay);

        this.formOverlay = formOverlay;
        this.backdrop = backdrop;
    }

    refresh() {
        const view = BOT_INSTANCE.itemsController.getViewByName(this.viewName);
        if(view.removed) {
            this.remove();
        }
        this.view.refresh();
    }

    remove() {
        this.formOverlay.remove();
        this.backdrop.remove();
    }
}


/*
  View Factory
*/

class BOTViewFactory{
    static createView(viewName, showHeader) {
        if (viewName === 'Playbooks') {
            return new BOTPlaybookView(showHeader); 
        }
        const view = BOT_INSTANCE.itemsController.getViewByName(viewName);
        if(view) {
            switch(view.viewName) {
                case 'Artifact overview':
                    return new BOTArtifactView(view.viewName, showHeader);
                    break;
                default:
                    return new BOTHTMLView(view.viewName, showHeader);
                    break;
            }
        }
        return null;
    }
}

class BOTGenericView{
    constructor(viewName, showHeader) {
        this.viewName = viewName;
        this.viewContainer = null;
        this.containerHeader = null;
        this.containerBody = null;
        this.runId = 0;
        this.showHeader = showHeader;
        this.init();
        this.refresh(true);
    }

    // get hte actual value of the item which should be passed to the input playbook
    // it's value by default but there are tags where value makes no sense
    static getData(element) {
        switch(element.tagName.toLowerCase()) {
            case "input":
                switch(element.getAttribute("type")) {
                    case "checkbox":
                        return element.checked; 
                    case "radio":
                        return element.checked;       
                }
            default:
                return element.value;
        }
    }

    getElement() {
        return this.viewContainer;
    }

    init() {
        this.viewContainer = document.createElement('div');
        this.viewContainer.classList.add('bot-view-container');
        this.containerHeader = document.createElement('div');
        this.containerBody = document.createElement('div');
        this.viewContainer.appendChild(this.containerHeader);
        this.viewContainer.appendChild(this.containerBody);

        // header
        if(this.showHeader) {
            this.containerHeader.classList.add('view-header');
            const title = document.createElement('h2');
            title.innerText = this.viewName;
            this.containerHeader.appendChild(title);
            this.containerHeader.onclick = () => {
                this.toggleBodyVisibility();
            }
            this.containerHeader.setAttribute('style', 'cursor: pointer;')
        }
        
        //body
        this.containerBody.classList.add('view-body');
    }

    refresh(force) {
        const view = BOT_INSTANCE.itemsController.getViewByName(this.viewName);
        if (this.runId < view.runId || force) {
            this.runId = view.runId;
            this.view = view;
            if (!this.view.removed) {
                this.containerBody.innerHTML = '';
                this.render();
            } else {
                this.remove();
            }            
        }
    }

    render() {}

    remove() {
        this.viewContainer.remove();
    }

    toggleBodyVisibility() {
        if(this.containerBody.getAttribute('hidden')) {
            this.containerBody.removeAttribute('hidden');
        } else {
            this.containerBody.setAttribute('hidden', 'true');
        }
    }
}

class BOTHTMLView extends BOTGenericView{
    constructor(viewName, showHeader) {
        super(viewName, showHeader);
    }

    render() {
        const content = document.createElement('div');
        content.innerHTML = this.view.data.html_content;
        this.containerBody.appendChild(content);
        var buttons = this.containerBody.querySelectorAll(".bot-playbook");
        for (const button of buttons) {
            button.onclick = (e) => PhantomClient.executePlaybook(button, this.containerBody);
        }
    }
}

class BOTArtifactView extends BOTGenericView{
    constructor(viewName, showHeader) {
        super(viewName, showHeader);
    }

    async render() {
        const artifactsPromise = PhantomClient.getArtifacts(BOT_INSTANCE.containerId);
        if (!this.cef_fields || !this.playbooks || !this.severities) {
            var cefUrl = '/rest/cef?page_size=0';
            var playbookUrl = '/rest/playbook?page_size=0&pretty=true';
            if (this.view.data.playbook_tags) {
                playbookUrl += "&_filter_tags__json_text_overlap=" + JSON.stringify(this.view.data.playbook_tags);
            }
            const severityUrl = '/rest/severity?page_size=0';
            const cefFieldPromise = PhantomClient.requestData(cefUrl);
            const playbooksPromise =  PhantomClient.requestData(playbookUrl);
            const severitiesPromise = PhantomClient.requestData(severityUrl);
            this.cefFields = await PhantomClient.awaitResult(cefFieldPromise);
            this.playbooks = await PhantomClient.awaitResult(playbooksPromise);
            this.severities = await PhantomClient.awaitResult(severitiesPromise);
        }
        const artifacts = await PhantomClient.awaitResult(artifactsPromise);
        
        const config = this.view.data;
        artifacts.forEach((artifact) => {
            if (config.artifact_labels?.length && !config.artifact_labels.includes(artifact.label)) {
                return;
            }
            if (config.artifact_severities?.length && !config.artifact_severities.includes(artifact.severity)) {
                return;
            }
            if (config.artifact_tags_include?.length && !config.artifact_tags_include.filter(n => artifact.tags.includes(n))?.length) {
                return;
            }
            if (config.artifact_tags_exclude?.length && config.artifact_tags_exclude.filter(n => artifact.tags.includes(n))?.length) {
                return;
            }

            var artifactDataTypes = Object.keys(artifact.cef).flatMap(cefField => {
                var cefFieldDefinition = this.cefFields.filter(i => i.name == cefField);
                if(cefFieldDefinition.length) {
                    cefFieldDefinition = cefFieldDefinition[0];
                } else {
                    return;
                }
                if (cefFieldDefinition && cefFieldDefinition.data_type?.length) {
                    return cefFieldDefinition.data_type;
                }
            }).filter(i => i);
            var artifactPlaybooks = this.playbooks.filter(playbook => playbook.tags.filter(n => artifactDataTypes.includes(n))?.length);
            if(config.artifacts_with_playbooks_only && artifactPlaybooks.length === 0) {
                return;
            }
            
            var severity = this.severities.filter(severity => severity.name === artifact.severity)[0];

            var artifactCard = this.createArtifactCard(artifact, artifactPlaybooks, severity);
            this.containerBody.appendChild(artifactCard);
        });
    }

    createArtifactCard(artifact, playbooks, artifactSeverty) {
        const  article = document.createElement('article');
        article.classList.add('bot-artifact');
        const header = document.createElement('header');
        const title = document.createElement('span');
        title.innerHTML = artifact.name ;
        article.appendChild(header);
        
        
        //severity
        const severity = document.createElement('div');
        severity.classList.add('bot-badge');
        severity.classList.add('badge');
        severity.classList.add('severity--' + artifactSeverty.color.replace('_', '-'));
        severity.innerHTML = artifactSeverty.name;
        header.appendChild(severity); 

        header.appendChild(title);   

        const tags = document.createElement('div');
        article.appendChild(tags);
        artifact.tags.forEach((tag_name) => {
            const tag = document.createElement("div");
            tag.classList.add('bot-badge');
            tag.classList.add('severity--dark-grey');
            tag.classList.add('badge');
            tag.innerHTML = tag_name;
            tags.appendChild(tag);
        });
        const playbookButtons = document.createElement("div");
        article.appendChild(playbookButtons);
        playbookButtons.classList.add('buttons');
        playbookButtons.classList.add('purple');
        playbooks.forEach((playbook) => {
            const button = document.createElement('button');
            button.classList.add('btn');
            button.classList.add('bot-button');
            button.classList.add('btn-phantom-primary');
            button.setAttribute('type', 'button');
            
            button.setAttribute('soar-playbook-id', playbook._pretty_scm + '/' + playbook.name);
            button.setAttribute('soar-playbook-scope', '[' + artifact.id + ']');
            button.setAttribute('title', playbook._pretty_docstring);
            button.onclick = (e) => PhantomClient.executePlaybook(button, this.containerBody);

            playbookButtons.appendChild(button);
            
            const btnDiv = document.createElement('div');
            btnDiv.classList.add('keyboard-focus--child');
            btnDiv.setAttribute('tabindex', -1);
            button.appendChild(btnDiv);

            const span = document.createElement('span');
            btnDiv.appendChild(span);

            const i = document.createElement('i');
            i.classList.add('fa');
            i.classList.add('fa-play');
            span.appendChild(i);
            span.insertAdjacentHTML('beforeend', playbook.name.toUpperCase().replace(/_/g, " "));
        });  
        return article;
    }
}

class BOTPlaybookView extends BOTGenericView{
    constructor(showHeader) {
        super('Playbooks', showHeader);
    }

    render() {
        const playbooks = BOT_INSTANCE.itemsController.getPlaybooksForSidebar();
        for (var playbook of playbooks) {
            const button = document.createElement('button');
            button.classList.add('btn');
            button.classList.add('bot-button');
            button.classList.add('btn-phantom-primary');
            button.setAttribute('type', 'button');
            
            button.setAttribute('soar-playbook-id', playbook.playbook);
            button.setAttribute('soar-playbook-scope', playbook.scope);
            button.onclick = (e) => {
                e.preventDefault();
                PhantomClient.executePlaybook(button, button);
            };
            
            const btnDiv = document.createElement('div');
            btnDiv.classList.add('keyboard-focus--child');
            btnDiv.setAttribute('tabindex', -1);
            button.appendChild(btnDiv);

            const span = document.createElement('span');
            btnDiv.appendChild(span);

            const i = document.createElement('i');
            i.classList.add('fa');
            i.classList.add('fa-play');
            span.appendChild(i);
            span.insertAdjacentHTML('beforeend', playbook.playbook.split('/')[1].toUpperCase().replaceAll('_', ' '));
            this.containerBody.appendChild(button);
        }
    }

    refresh(force) {
        const playbooks = BOT_INSTANCE.itemsController.getPlaybooksForSidebar();
        if (playbooks.length > 0) {
            this.containerBody.innerHTML = '';
            this.render();
        } else {
            this.remove();
        }
    }
}


/*
  Main class
*/
class BagOfTricks{
    constructor() {
        this.anchor = document.getElementById('bot-anchor');        
        this.appName = document.getElementById("bot-app-name").textContent;
        this.appPath = document.getElementById("bot-app-path").textContent;
        this.appLogo = document.getElementById("bot-app-logo").textContent;
        this.config = JSON.parse(document.getElementById("bot-app-config").textContent)

        BOTStyle.AddStyle();
        this.instanceAnchor = null;
        this.itemsController = new BOTItemsController(this.appName);
        this.button = new BOTButton(this);
        this.sidebar = new BOTSidebar();
        this.overlay = null;
        this.checkInstanceAnchor();
    }

    showOverlay(viewName) {
        this.overlay = new BOTOverlayForm(viewName);
        this.overlay.showOverlay();
    }

    checkInstanceAnchor() {
        if(!this.instanceAnchor || !document.body.contains(this.instanceAnchor)) {
            this.containerId = document.getElementById("bot-container-id").textContent;
            this.itemsController.changeEvent(this.containerId);
            // place new instance anchor
            this.instanceAnchor = document.createElement('div');
            this.instanceAnchor.id = 'bot-instance-anchor';
            this.instanceAnchor.setAttribute('hidden', 'true');
            const indicentTitle = document.getElementsByClassName('c-IncidentHeader__eventName')[0];
            indicentTitle.appendChild(this.instanceAnchor);
            if(this.button) {
                this.button.createButton();
            }            
            if(this.sidebar) {
                this.sidebar.reset();
            }                
        }
    }

    refresh() {
        if(this.sidebar) {
            this.sidebar.refresh();
        }
        if(this.overlay) {
            this.overlay.refresh();
        }
    }
}

class BOTStyle{
    static AddStyle() {
        // get colors from scheme
        const cssProps = window.getComputedStyle(document.getElementById('activity-header'), null);
        const backgroundColor = cssProps.getPropertyValue('background-color');
        const borderColor = cssProps.getPropertyValue('border-bottom-color');
        const textColor = cssProps.getPropertyValue('color');

        const ccsPropsTabBar = window.getComputedStyle(document.getElementsByClassName('tabs')[0], null);
        const headBackground = ccsPropsTabBar.getPropertyValue('background-color');

        var style = `
                #bot-sidebar {
                    top: 125px;
                    width: 15%;
                    box-sizing: border-box;
                    position: sticky;
                    display: flex;
                    flex-direction: column;
                    background-color: #background-color#;
                }
                #bot-sidebar > .sidebar-body {                  
                    overflow: auto;
                    padding: 0 8px 0 8px;
                }
                .sidebar-title {
                    background-color: #head-background-color#;
                    border-bottom: 1px solid #border-color#;
                    border-top: 1px solid #border-color#;
                    border-left: 1px solid #border-color#;
                    box-sizing: border-box;
                    margin: 0;
                    padding: 0;
                    z-index: 11 !important;
                }
                .sidebar-title > span {
                    color: #text-color#;
                    line-height: 49px;
                    font-size: 13px;
                    font-weight: 400;
                    font-family: Roboto,sans-serif;
                    font-style: normal;
                    direction: ltr;
                    text-align: left;
                    padding-left: 35px;
                }

                #bot-sidebar > .sidebar-title {
                    top: 125px;
                    position: sticky;
                }

                .view-header {
                    position: sticky;
                }

                .view-body {
                    overflow: hidden;
                }

                .bot-artifact {
                    /*margin: 0 5px 5px 5px;*/
                    padding: 0 5px 5px 5px;
                    border: 1px solid #border-color#;
                    overflow: hidden;
                }

                .bot-badge {
                    margin-right: 3px; 
                }

                .bot-button {
                    margin-right: 3px;
                }

                .bot-view-container {
                    /*border: 2px solid #border-color#;*/
                }
            `;

        style = style.replaceAll('#head-background-color#', headBackground.match(/[0-9]+/g).reduce((a, b) => a+(b|256).toString(16).slice(1), '#'));
        style = style.replaceAll('#background-color#', backgroundColor.match(/[0-9]+/g).reduce((a, b) => a+(b|256).toString(16).slice(1), '#'));
        style = style.replaceAll('#border-color#', borderColor.match(/[0-9]+/g).reduce((a, b) => a+(b|256).toString(16).slice(1), '#'));
        style = style.replaceAll('#text-color#', textColor.match(/[0-9]+/g).reduce((a, b) => a+(b|256).toString(16).slice(1), '#'));

        const styleSheet = document.createElement('style');
        styleSheet.innerText = style;
        const anchor = document.getElementById('bot-anchor');
        anchor.appendChild(styleSheet);
    }
}

BOT_INSTANCE = new BagOfTricks();

BOT_SCRIPT_LOADED_CALLBACK();
console.log('BoT plugin loaded');