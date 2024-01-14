$(function () { //DOM Ready
    // your page initialization code here
    // the DOM will be available here
    //define here what to do if a text comes in to be shown


    $("#tabs").tabs();
    $("#accordion").accordion();
    $("#indexbutton").button({
        icons: {
            primary: "ui-icon-home"
        }
    });
    $("#button").button({
        icons: {
            primary: "ui-icon-refresh"
        }
    });
    $("#check").button({
        icons: {
            primary: "ui-icon-clock"
        }
    });
    $("#outputclear").button({
        icons: {
            primary: "ui-icon-trash"
        }
    });
    $("#outputlog").button({
        icons: {
            primary: "ui-icon-pencil"
        }
    });
    $("#outputsave").button({
        icons: {
            primary: "ui-icon-disk"
        }
    });
    $("#radioset").buttonset();
    $("#dialog").dialog({
        autoOpen: false,
        width: 400,
        buttons: [{
            text: "Ok",
            click: function () {
                $(this).dialog("close");
            }
        }, {
            text: "Cancel",
            click: function () {
                $(this).dialog("close");
            }
        }]
    });
    // Link to open the dialog
    $("#dialog-link").click(function (event) {
        $("#dialog").dialog("open");
        event.preventDefault();
    });
    $("#datepicker").datepicker({
        inline: true
    });
    $("#slider").slider({
        range: true,
        values: [17, 67]
    });
    $("#progressbar").progressbar({
        value: 20
    });
    $("#spinner").spinner();
    $("#menu").menu();
    $("#tooltip").tooltip();
    $("#selectmenu").selectmenu();
    // Hover states on the static widgets
    $("#dialog-link, #icons li").hover(
        function () {
            $(this).addClass("ui-state-hover");
        },
        function () {
            $(this).removeClass("ui-state-hover");
        }
    );






    let directory;
    document.getElementById('dir').addEventListener('click', async () => {
        try {
            directory = await window.showDirectoryPicker({
                startIn: 'desktop'
            });

            for await (const entry of directory.values()) {
                let newEl = document.createElement('div');
                newEl.innerHTML = `<strong>${entry.name}</strong> - ${entry.kind}`;
                document.getElementById('folder_info').append(newEl);
            }
        } catch (e) {
            console.log(e);
        }
    });

    document.getElementById('save').addEventListener('click', async () => {
        try {
            // Creates a file
            let saveFile = await directory.getFileHandle('newFile.txt', { create: true });
            if (saveFile !== "undefined") {
                const writable = await saveFile.createWritable();
                await writable.write("moin");
                await writable.close();
            }
        } catch (e) {
            console.log(e);
        }
    });

    let lineBuffer = '';
    let latestValue = 0;

    const connectButton = document.getElementById('connect-to-serial');
    let port;

    if ('serial' in navigator) {
        connectButton.addEventListener('click', function () {
            if (port) {
                port.close();
                port = undefined;

                connectButton.innerText = '🔌 Connect';
            }
            else {
                getReader();
            }
        });

        connectButton.disabled = false;
    }

    async function getReader() {
        port = await navigator.serial.requestPort({});
        await port.open({ baudRate: 115200 });

        connectButton.innerText = '🔌 Disconnect';

        const appendStream = new WritableStream({
            write(chunk) {
                lineBuffer += chunk;

                let lines = lineBuffer.split('\n');

                if (lines.length > 1) {
                    lineBuffer = lines.pop();
                    console.log(lines.pop().trim())
                }
            }
        });

        port.readable
            .pipeThrough(new TextDecoderStream())
            .pipeTo(appendStream);
    }
});