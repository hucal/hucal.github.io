sample_data = {
   "file_table_columns":  ["address", "ptr", "name", "size"],
   "data_region_columns": ["address", "data", "empty", "next"],
   "file_table": [
       {"ptr": null, "name": "", "size": 0},
       {"ptr": 2, "name": "main.c", "size": 39},
       {"ptr": 3, "name": "main.py", "size": 22},
       {"ptr": null, "name": "", "size": 0},
       {"ptr": 1, "name": "test", "size": 4},
       {"ptr": null, "name": "empty.txt", "size": 0}
    ],
   "data_region": [
       {"data": "", "empty": true, "next": null},
       {"data": "abcd", "empty": false, "next": null},
       {"data": "int main(int n, char** a", "empty": false, "next": 5},
       {"data": "import sys;sys.exit(0)", "empty": false, "next": null},
       {"data": "", "empty": true, "next": null},
       {"data": ") { return 0; }", "empty": false, "next": null}
   ],
   "file_descriptors": [{"file_ptr": 1, "cursor": 4},
                        {"file_ptr": null, "cursor": 6},
                        {"file_ptr": 4, "cursor": 2},
                        {"file_ptr": null, "cursor": 0}]
}

var minimum_rows_per_table = 15;
var highlighted_elements = [];
var current_data = sample_data;

/* Add interactive elements to document. */
visualize_json(sample_data);

/* Handle JSON input */
document.getElementById("submit_json").onclick = function() { submitJSON(); };

function submitJSON() {
     visualize_json(JSON.parse(document.getElementById("json_input").value));
}

function visualize_json(data) {
    if (data["file_table_columns"] === undefined) {
        alert("Invalid JSON.");
        return;
    }

    var max_file_columns = 1;
    var max_data_columns = 3;

    d3.selectAll("div#vis").selectAll("*").remove();
    highlighted_elements = [];
    current_data = data;
    create_table("div#file_table div#vis",
            data["file_table_columns"], data["file_table"],
            function (d) {
                if (d.column != "address" && d.row.ptr === null) {
                    if (d.column == "name") {
                        return "&lt;free&gt;";
                    }
                    return "";
                } else {
                    if (d.column == "address") {
                        return d.value + ": ";
                    }
                    return d.value;
                }
            }, max_file_columns);

    create_table("div#data_region div#vis",
            data["data_region_columns"], data["data_region"],
            function (d) {
                if (d.column == "address") {
                    return d.value + ": ";
                }
                if (d.column == "next" && d.value === null) {
                    return "";
                }
                if (d.column == "empty") {
                    return d.value ? "✓" : "";
                }
                var max_chars = 16;
                if (d.column == "data" && d.value.length > max_chars) {
                    return d.value.substring(0, max_chars) + "...";
                }
                return d.value;
            }, max_data_columns);

    var fds = d3.select("div#file_descriptors div#vis")
                .append("div")
                .append("table")
                .append("tr");
    fds.selectAll("td").data(data["file_descriptors"])
       .enter()
       .append("td")
       .each(function (d) { d.doc_element = this; })
       .on("click", highlight_all)
       .on("mouseover", highlight_all)
       .text(function(d) {
           return (d.file_ptr === null) ? "empty"
                : ("file: " + d.file_ptr + " cursor at " + d.cursor);
       });

    file_data = [];
    var contents, block;
    for (var d in data["file_table"]) {
         file = data["file_table"][d];
         if (file.ptr !== null && file.ptr >= 0) {
             contents = "";
             block = data["data_region"][file.ptr];

             console.log(block);
             /* read linked list of blocks */
             while (!block.empty) {
                 contents += block.data;
                 if (block.next !== null) {
                     block = data["data_region"][block.next];
                 } else {
                     break
                 }
             }

             file_data.push({"file": file, "contents": contents});
         }
    }

    var files = d3.select("div#files div#vis").selectAll("p")
        .data(file_data)
        .enter()
        .append("div");

    files.append("h4")
        .text(function (f) { return f.file.name; })
    files.append("span")
         .text(function (f) {
             return "File size " + f.file.size
                  + " bytes, name size " + f.file.name.length + ". Contents:";
         })
    files.append("p")
        .text(function (f) { return f.contents; });
}

function highlight_all(d) {
     for (var e in highlighted_elements) {
         e = highlighted_elements[e];
         d3.select(e.doc_element).classed("highlight", false);
     }

     highlighted_elements = find_associated_elements(d);
     for (var e in highlighted_elements) {
         e = highlighted_elements[e];
         d3.select(e.doc_element).classed("highlight", true);
     }
}

function valid_ptr(p) { return p !== undefined && p !== null && p >= 0; }

function find_associated_elements(d) {
     var e = [d];
     if (valid_ptr(d.next) && (d.empty === false)) {
         e = e.concat(find_associated_elements(current_data["data_region"][d.next]));
     }
     if (valid_ptr(d.ptr)) {
         e = e.concat(find_associated_elements(current_data["data_region"][d.ptr]));
     }
     if (valid_ptr(d.file_ptr)) {
         e = e.concat(find_associated_elements(current_data["file_table"][d.file_ptr]));
     }
     return e;
}

function get_classes(element) {
     var v = d3.select(element).attr("class");
     if (v === null) {
         return "";
     }
     return v;
}

function create_table(where, column_names, data, mk_element_text, max_columns) {
    var rows_per_table = Math.max(minimum_rows_per_table, Math.ceil(data.length / max_columns));
    var rows_written = 0;

    where = d3.select(where).append("div").attr("class", "row");

    while (rows_written < data.length) {
        var current_data = data.slice(rows_written, rows_written + rows_per_table);
        console.log(current_data);
        rows_written += current_data.length;
        var table = where.append("div").attr("class", "col").append("table");

        var thead = table.append("thead");
        var tbody = table.append("tbody");

        thead.append("tr")
            .selectAll("th")
            .data(column_names)
            .enter()
            .append("th")
            .attr("class", function(d) {
                return get_classes(this) + " " + d;
            })
            .text(function (d) {return d == "address" ? "" : d;});

        var rows = tbody.selectAll("tr")
            .data(current_data)
            .enter()
            .append("tr")
            .each(function (d) { d.doc_element = this; })
                .on("click", highlight_all)
            .on("mouseover", highlight_all)
            .attr("class", function(r) {
                return get_classes(this) + " " +
                    ((r.empty === true || r.ptr === null) ? "no_data" : "");
            });

        var cells = rows.selectAll("td")
            .data(function(row, i) {
                d = [{column: "address",
                      value: i + rows_written - current_data.length,
                      row: row}];
                for (var col in column_names) {
                    col = column_names[col];
                    if (col == "address") {
                        continue;
                    }
                    d.push({column: col, value: row[col], row: row});
                }
                return d;
            })
            .enter()
            .append("td")
            .attr("class", function(d) {
                return get_classes(this) + " " + d.column;
            })
            .html(mk_element_text);
    }
}

