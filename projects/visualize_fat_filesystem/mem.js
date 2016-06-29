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
            });

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
                return d.value;
            });
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
         if (file.ptr !== null) {
             contents = "";
             block = data["data_region"][file.ptr];

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
     if (valid_ptr(d.next)) {
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

function create_table(where, column_names, data, mk_element_text) {
    var table = d3.select(where)
    .append("table");

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
    .data(data)
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
            data = [{column: "address", value: i, row: row}];
            for (var col in column_names) {
                col = column_names[col];
                if (col == "address") {
                    continue;
                }
                data.push({column: col, value: row[col], row: row});
            }
            return data;
        }
    )
    .enter()
    .append("td")
    .attr("class", function(d) {
        return get_classes(this) + " " + d.column;
    })
    .html(mk_element_text);
}

