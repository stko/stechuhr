$(function () { //DOM Ready
    // your page initialization code here
    // the DOM will be available here
    //define here what to do if a text comes in to be shown


    let directory = null // the handle for our local working directory
    let time_records = {} // persistent data structure store all of the tick inputs
    let time_records_file_handle = null // global file handle storage to keep the user permissions
    let projects_template = {} // the template which defines the existing projects and to which position they belong to 
    let last_indexed_day = 0 // used as helper flag, when the table indices have to be re-assigned to the actual tick table
    let table_update_references = { first_tick: null, last_tick: null, projects: [] }
    let table_content = {}
    let last_timestamp = 0
    let show_raw = false // shows raw tick values in table if true
    let year = 0
    let month = 0
    let day = 0
    let selected_year = 0
    let selected_month = 0
    let TICKS_TO_DATA_STORAGE = 5
    let ticks_to_storage_counter = 0

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
    }).change(function () {
        refresh_table()
    });
    $("#clipboard").button({
        icons: {
            primary: "ui-icon-copy"
        }
    }).click(function (event) {
        copy_to_clipboard()
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
    $("#select_year").selectmenu().on('selectmenuchange', function () {
        selected_year = $("#select_year").val()
        fill_selectors()
        refresh_table()
    });
    $("#select_month").selectmenu().on('selectmenuchange', function () {
        selected_month = $("#select_month").val()
        refresh_table()
    });
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


    function timestamp_to_time(timestamp) {
        let datetime = new Date(timestamp)
        let mins = datetime.getMinutes()
        if (mins < 10) {
            mins = "0" + mins
        }
        return datetime.getHours() + ":" + mins
    }

    function minutes_to_time(minutes) {
        hours = Math.floor(minutes / 60)
        mins = minutes - (hours * 60)
        if (hours < 10) {
            hours = "0" + hours
        }
        if (mins < 10) {
            mins = "0" + mins
        }
        return hours + ":" + mins
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

    function copy_to_clipboard() {
        //  2 blanks first
        result = "\t"
        // now the days
        for (var i = 1; i < 32; ++i) {
            result += "\t" + i
        }
        result += "\n" // new line

        /*
        // Create the next table row (first tick)
        //  2 blanks first
        result ="\t"

        // now the days
        for (var i = 1; i < 32; ++i) {
            result += "\t" + show_raw ? table_content[i].first_tick.value : table_content[i].first_tick.display
        }


        // Create the next table row (first tick)
        //  2 blanks first
        result ="\t"

        // now the days
        for (var i = 1; i < 32; ++i) {
            result += "\t" + show_raw ? table_content[i].last_tick.value : table_content[i].last_tick.display
        }
        */

        // Create data rows
        Object.keys(projects_template).forEach(key => {
            result += key;
            result += projects_template[key];
            for (var i = 1; i < 32; ++i) {
                if (key in table_content[i].projects) {
                    result += "\t" + (show_raw ? table_content[i].projects[key].ticks : table_content[i].projects[key].value.toString().replace(".",","))
                } else {
                    result += "\t";
                }
            }
            result += "\n" // new line
        });

        // copy to clipboard
        console.log(result)
        navigator.clipboard.writeText(result);
    }


    function fill_selectors() {

        $("#select_year" + " option").remove()
        $("#select_month" + " option").remove()
        Object.keys(time_records).forEach(key => {
            $("#select_year").append($("<option>")
                .val(key)
                .html(key)
            );
        })
        if (!(selected_year in time_records) && Object.keys(time_records).length > 0) {
            selected_year = Object.keys(time_records)[0]
        }
        $('#select_year').val(selected_year).selectmenu("refresh");
        months = time_records[selected_year]
        Object.keys(months).forEach(key => {
            $("#select_month").append($("<option>")
                .val(key)
                .html(key)
            );
        })
        if (!(selected_month in months) && Object.keys(months).length > 0) {
            selected_month = Object.keys(months)[0]
        }
        $('#select_month').val(selected_month).selectmenu("refresh");
    }

    function prepare_table_column_content(this_year, this_month, this_day, round_to_mins) {
        /*
            takes the given year, month and date and tries to calculate the table column data out of 
        */
        column_data = {
            first_tick: { value: "", display: "", style: "" },
            last_tick: { value: "", display: "", style: "" },
            projects: {}
        }
        if (!(this_year in time_records && this_month in time_records[this_year] && this_day in time_records[this_year][this_month])) {
            return column_data
        }
        this_day_data = time_records[this_year][this_month][this_day]
        column_data.first_tick = { value: this_day_data.first_tick, display: timestamp_to_time(this_day_data.first_tick), style: "" }
        column_data.last_tick = { value: this_day_data.last_tick, display: timestamp_to_time(this_day_data.last_tick), style: "" }
        minutes_of_day = (this_day_data.last_tick - this_day_data.first_tick) / (60 * 1000) // make minutes out of timestamp

        // round up the minutes

        minutes_of_day = Math.floor((minutes_of_day + round_to_mins / 2) / round_to_mins) * round_to_mins

        ticks_of_day = 0
        Object.keys(this_day_data.ticks).forEach(key => {
            ticks_of_day += this_day_data.ticks[key]
        })
        Object.keys(this_day_data.ticks).forEach(key => {
            this_ticks = this_day_data.ticks[key]
            this_minutes = minutes_of_day / ticks_of_day * this_ticks // first we calculate the real minutes
            this_minutes_rounded = Math.floor((this_minutes + round_to_mins / 2) / round_to_mins) * round_to_mins
            console.log("minutes_of_day", minutes_of_day, "ticks_of_day", ticks_of_day, "this_ticks", this_ticks, "this_minutes", this_minutes, "this_minutes_rounded", this_minutes_rounded)
            minutes_of_day -= this_minutes_rounded
            ticks_of_day -= this_ticks
            column_data.projects[key] = {
                value: this_minutes_rounded / 60,
                ticks: this_ticks,
                display: minutes_to_time(this_minutes_rounded),
                style: ""
            }
        })
        console.log(column_data)
        return column_data
    }

    function refresh_table() {
        init_table(selected_year, selected_month)
        show_raw = $("#raw_ticks").is(':checked');
        init_html_table("#time_table", selected_year, selected_month, show_raw)
    }

    function init_table(actual_year, actual_month) {

        for (var i = 1; i < 32; ++i) {
            table_content[i] = prepare_table_column_content(actual_year, actual_month, i, 15)
        }
    }

    function init_html_table(table_div_id, actual_year, actual_month, show_raw) {
        $(table_div_id + " table").remove()

        // Create a table element
        var table = document.createElement("table");
        $(table).attr("width", "100%")

        // Create a table row (header row)
        var headerRow = table.insertRow();

        // Create header cells
        var cell = headerRow.insertCell();
        cell.innerHTML = "Projekt";

        cell = headerRow.insertCell();
        cell.innerHTML = "Gl&uuml;cksrad";

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
            cell.innerHTML = show_raw ? table_content[i].first_tick.value : table_content[i].first_tick.display
            // lets see if the actual column is exactly today
            if (actual_year == year && actual_month == month && i == day) {
                table_update_references.first_tick = cell
            }
        }
        // Create the second table row (header row)
        var headerRow = table.insertRow();
        //  2 blanks first
        cell = headerRow.insertCell();
        cell = headerRow.insertCell();

        // now the days
        for (var i = 1; i < 32; ++i) {
            cell = headerRow.insertCell();
            cell.innerHTML = show_raw ? table_content[i].last_tick.value : table_content[i].last_tick.display
            // lets see if the actual column is exactly today
            if (actual_year == year && actual_month == month && i == day) {
                table_update_references.last_tick = cell
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
                if (key in table_content[i].projects) {
                    cell.innerHTML = show_raw ? table_content[i].projects[key].ticks : table_content[i].projects[key].display
                } else {
                    cell.innerHTML = ".";
                }
                if (actual_year == year && actual_month == month && i == day && projects_template[key] != 0) {
                    table_update_references.projects[key] = cell
                }
            }
        });

        // Append the table to the body of the document
        $(table_div_id).append(table);

    }

    function update_todays_column(project, tick) {
        if (table_update_references.first_tick.innerHTML == "") {
            table_update_references.first_tick.innerHTML = timestamp_to_time(last_timestamp)
        }
        table_update_references.last_tick.innerHTML = timestamp_to_time(last_timestamp)
        if (project in table_update_references.projects) {
            table_update_references.projects[project].innerHTML = tick
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
        if (position == 0) {
            project_of_position = "break"
        } else {
            project_of_position = 0
            Object.keys(projects_template).forEach(key => {
                if (projects_template[key] == position) {
                    project_of_position = key
                }
            })
        }
        if (project_of_position === 0) { // the position does not have a project assigned
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
        if (!(project_of_position in todays_ticks)) {
            todays_ticks[project_of_position] = 0
        }
        todays_ticks[project_of_position] += 1
        update_todays_column(project_of_position, todays_ticks[project_of_position])
    }

    function timer_interval() {
        //console.log("tick")
        // update the internal time variables
        last_timestamp = Date.now()
        var date = new Date(last_timestamp)
        year = date.getFullYear();
        month = date.getMonth() + 1; //  (note zero index: Jan = 0, Dec = 11)
        if (selected_year == 0) {
            selected_year = year
            selected_month = month
        }
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
            fill_selectors()
            refresh_table()
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
                        if (wheel_data !== undefined && wheel_data.calibrated && !wheel_data.turning) {
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