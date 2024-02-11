$(function () { //DOM Ready
    // your page initialization code here
    // the DOM will be available here
    //define here what to do if a text comes in to be shown


    $("#tabs").tabs();
    $("#indexbutton").button({
        icons: {
            primary: "ui-icon-home"
        }
    });
    $("#dir").button({
        icons: {
            primary: "ui-icon-dir"
        }
    });
    $("#connect-to-serial").button({
        icons: {
            primary: "ui-icon-connect"
        }
    });
    $("#raw_ticks").button({
        icons: {
            primary: "ui-icon-pencil"
        }
    });
    $("#clipboard").button({
        icons: {
            primary: "ui-icon-copy"
        }
    });
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
    $("#select_year").spinner();
    $("#select_month").spinner();
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

    let directory = null // the handle for our local working directory
    let time_records = {} // persistent data structure store all of the tick inputs
    let time_records_file_handle = null // global file handle storage to keep the user permissions
    let projects_template = {} // the template which defines the existing projects and to which position they belong to 
    let last_indexed_day = 0 // used as helper flag, when the table indices have to be re-assigned to the actual tick table
    let table_update_references = { first_tick:null, last_tick:null, projects:[] }
    let last_timestamp = 0
    let year = 0
    let month = 0
    let day = 0
    let TICKS_TO_DATA_STORAGE = 5
    let ticks_to_storage_counter = 0

    function timestamp_to_time(timestamp){
        let datetime = new Date(timestamp)
        let mins = datetime.getMinutes()
        if (mins < 10) {
            mins = "0" + mins
        }
        return datetime.getHours() + ":" + mins
    }

    async function save_to_file(file_handle, content) {
        if (directory != null) {
            try {
                // Creates a file
                if (file_handle !== "undefined") {
                    const writable = await file_handle.createWritable();
                    await writable.write(content);
                    await writable.close();
                }
            } catch (e) {
                console.log(e);
            }
        }
    }

    function init_table(table_div_id, actual_year, actual_month) {
        $(table_div_id + " table").remove()

        // Create a table element
        var table = document.createElement("table");
        $(table).attr("width","100%")

        // Create a table row (header row)
        var headerRow = table.insertRow();

        // Create header cells
        var cell = headerRow.insertCell();
        cell.innerHTML = "Projekt";

        cell = headerRow.insertCell();
        cell.innerHTML = "Scheibe";

        for (var i = 1; i < 32; ++i) {
            cell = headerRow.insertCell();
            cell.innerHTML = i;
        }
        // first we draw two empty rows for end and start time

        // Create the first table row (header row)
        var headerRow = table.insertRow();
        //  2 blanks first
        cell = headerRow.insertCell();
        cell = headerRow.insertCell();

        // now the days
        for (var i = 1; i < 32; ++i) {
            cell = headerRow.insertCell();
            if (actual_year in time_records && actual_month in time_records[actual_year] && i in time_records[actual_year][actual_month]) {
                cell.innerHTML = timestamp_to_time(time_records[actual_year][actual_month][i].first_tick)
            }
            // lets see if the actual column is exactly today
            if (actual_year == year && actual_month==month && i == day){
                table_update_references.first_tick=cell
           }        }
        // Create the second table row (header row)
        var headerRow = table.insertRow();
        //  2 blanks first
        cell = headerRow.insertCell();
        cell = headerRow.insertCell();

        // now the days
        for (var i = 1; i < 32; ++i) {
            cell = headerRow.insertCell();
            if (actual_year in time_records && actual_month in time_records[actual_year] && i in time_records[actual_year][actual_month]) {
                cell.innerHTML = timestamp_to_time(time_records[actual_year][actual_month][i].last_tick)
            }
            // lets see if the actual column is exactly today
            if (actual_year == year && actual_month==month && i == day){
                 table_update_references.last_tick=cell
            }
        }

        // Create data rows
        Object.keys(projects_template).forEach(key => {
            console.log(key, projects_template[key]);
            var row = table.insertRow();
            cell = row.insertCell();
            cell.innerHTML = key;
            cell = row.insertCell();
            cell.innerHTML = projects_template[key];
            for (var i = 1; i < 32; ++i) {
                cell = row.insertCell();
                cell.innerHTML = i;
                if (actual_year == year && actual_month==month && i == day && projects_template[key]!=0){
                    table_update_references.projects[projects_template[key]]=cell
                }
            }
        });

        // Append the table to the body of the document
        $(table_div_id).append(table);

    }

    function update_todays_column( project, tick){
        if (table_update_references.first_tick.innerHTML==""){
            table_update_references.first_tick.innerHTML=timestamp_to_time(last_timestamp)
        }
        table_update_references.last_tick.innerHTML=timestamp_to_time(last_timestamp)
        if (project in table_update_references.projects){
            table_update_references.projects[project].innerHTML=tick
        }
    }

    async function load_from_file(file_name) {
        // https://developer.chrome.com/docs/capabilities/web-apis/file-system-access?hl=de#read_a_file_from_the_file_system
        if (directory) {
            const draftHandle = await directory.getFileHandle(file_name);
            const fileData = await draftHandle.getFile();
            return fileData.text();
        } else {
            return ""
        }
    }

    function store_tick(position) {
        if (last_timestamp == 0) { // the system has not set up yet
            return
        }
        if (!(year in time_records)) {
            time_records[year] = {}
        }
        year_record = time_records[year]
        if (!(month in year_record)) {
            year_record[month] = {}
        }
        month_record = year_record[month]
        if (!(day in month_record)) {
            month_record[day] = {
                first_tick: last_timestamp,
                last_tick: last_timestamp,
                ticks: {}
            }
        }
        day_record = month_record[day]
        todays_ticks = day_record.ticks
        day_record.last_tick = last_timestamp
        if (!(position in todays_ticks)) {
            todays_ticks[position] = 0
        }
        todays_ticks[position] += 1
        update_todays_column(position,todays_ticks[position])
    }

    function timer_interval() {
        //console.log("tick")
        // update the internal time variables
        last_timestamp = Date.now()
        var date = new Date(last_timestamp)
        year = date.getFullYear();
        month = date.getMonth() + 1; //  (note zero index: Jan = 0, Dec = 11)
        day = date.getDate();
        // is it time for a data backup?
        ticks_to_storage_counter -= 1
        if (ticks_to_storage_counter < 1) {
            ticks_to_storage_counter = TICKS_TO_DATA_STORAGE
            save_to_file(time_records_file_handle, JSON.stringify(time_records))
        }
    }
    setInterval(timer_interval, 5000);



    document.getElementById('dir').addEventListener('click', async () => {
        try {
            directory = await window.showDirectoryPicker({
                startIn: 'desktop'
            });
            /*
            for await (const entry of directory.values()) {
                let newEl = document.createElement('div');
                newEl.innerHTML = `<strong>${entry.name}</strong> - ${entry.kind}`;
                document.getElementById('time_table').append(newEl);
            }
            */
            projects_template_string = await load_from_file("stechuhr.config")
            projects_template = JSON.parse(projects_template_string)
            time_records_file_handle = await directory.getFileHandle("time_records.json", { create: true });
            time_records_input_string = await load_from_file("time_records.json")
            time_records = JSON.parse(time_records_input_string)
            init_table("#time_table", year, month)
            console.log(projects_template)
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

                while (lines.length > 1) {
                    lineBuffer = ""
                    line = lines.pop().trim();
                    line = lines.pop().trim();
                    console.log(line)
                    try {
                        wheel_data = JSON.parse(line)
                        if (wheel_data !== undefined && wheel_data.calibrated) {
                            store_tick(wheel_data.position)
                        }
                    } catch (error) {

                    }
                }
            }
        });

        port.readable
            .pipeThrough(new TextDecoderStream())
            .pipeTo(appendStream);
    }



});