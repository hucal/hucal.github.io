/*************************** color legend ************************************/
function draw_color_legend(title, get_name, color, where, sz) {
    if (where === undefined)
        where = d3.select("div#vis");
    if (sz === undefined)
        sz = 20

    var legend = where.append("svg")
        .attr("class", "legends")
        .attr("width", (sz * 2) * Math.max(color.domain().length))
        .attr("height", 100);

    var g = legend.append("g")
            .attr("transform", "translate(5,20)"); // margins

    g.append("text")
        .attr("class", "legend-title")
        .text(title);

    legend_elems = g.selectAll("g.legend-elem")
        .data(color.domain())
      .enter().append("g")
        .attr("class", "legend-elem")
        .attr("transform", function(d, i)
            { return "translate(" + (i * sz * 2) +",15)"; })
        ;

    legend_elems.append("text")
        .text(get_name);

    legend_elems.append("rect")
        .attr("fill", function(d) { return color(d); })
        .attr("y", 3)
        .attr("width", sz)
        .attr("height", sz / 2);

    return legend;
}
