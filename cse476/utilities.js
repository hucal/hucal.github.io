if (typeof String.prototype.endsWith !== 'function') {
    String.prototype.endsWith = function(suffix) {
            return this.indexOf(suffix, this.length - suffix.length) !== -1;
        };
}





/************************* GRAPH GENERATION *********************************/

function random_nodes(min, max) {
    if (arguments.length !== 2) {
        min = 5;
        max = 10;
    }
    var nodes = d3.range(randint(min, max));
    nodes = nodes.map(function () {
        d = {
        a: randint(0,3),
        b: randint(5, 100) / 100};
        return d;
    });
    return nodes;
}

function random_links(nodes, min, max, rand_node_picker) {
    // only one argument? then E = 2V
    if (!arguments.length === 1) {
        min = nodes.length;
        max = min;
        rand_node_picker = randint;
    }
    var links = d3.range(randint(min, max));
    links = links.map(function() {
        d = {
        source: rand_node_picker(0, nodes.length),
        target: rand_node_picker(0, nodes.length),
        }
        return d;
    });
    if (!arguments.length === 1)
        nodes.forEach(function (node, node_ix) {
            var sink = Math.random() > 0.5;
            links.push({
            source: sink ? node_ix : randint(0, nodes.length),
            target: sink ? randint(0, nodes.length) : node_ix,
            });
        });
    return links;
}

function randint(min, max) { return min === max ?
    max : min + Math.floor(Math.random() * (max - min)); }

function mk_randint_normal(min, max) {
    var dist = d3.random.normal((min + max) / 2,
            Math.sqrt((max - min) * (max - min) / 12));
    return function() {
        return min === max ?
        max : clamp(min, max, Math.floor(dist()));
    }
}

function clamp(min, max, x) { return x < min ? min : x > max ? max : x; }







/******** graph utlities *************/
function findByName(l, n) {
    for (var i = 0; i < l.length; i++)
        if (l[i].name === n) return i;
    return -1;
}

function by_obj_to_ix(nodes, links) {
    links.forEach(function(l) {
        l.source = findByName(nodes, l.source);
        l.target = findByName(nodes, l.target);
    });
}

function find_degree(nodes, links, mk_neighbor_list) {
    nodes.forEach(function(n) { n.deg = 0, n.deg_in = 0, n.deg_out = 0;
        if (mk_neighbor_list) {
            n.neigh_in = [];
            n.neigh_out = [];
        }
    });
    links.forEach(function(l) {
        nodes[l.source].deg_out++;
        nodes[l.target].deg_in++;

        if (mk_neighbor_list) {
            nodes[l.source].neigh_out.push(l.target);
            nodes[l.target].neigh_in.push(l.source);
        }

    });
    var min_deg = 0, max_deg = 0;
    nodes.forEach(function(n, i) {
        n.deg = n.deg_in + n.deg_out;
        if (nodes[min_deg].deg > n.deg) min_deg = i;
        if (nodes[max_deg].deg < n.deg) max_deg = i;
    });
    return {min: min_deg, max: max_deg,
            min_val: nodes[min_deg].deg, max_val: nodes[max_deg].deg,
            quantile: d3.scale.linear()
                .domain(d3.range(0, nodes[max_deg].deg, nodes[max_deg].deg/3))
                .interpolate(interpolateFloor)
                .range(d3.range(0,3)).clamp(true) };
}

function find_next_neighbors(nodes, links) {
    if (nodes[0].neigh_in === undefined)
        find_degree(nodes, links, true);
    var min_nn = max_nn = 0;
    nodes.forEach(function(n) {
        n.nn_in = {};
        n.nn_out = {};
        n.neigh_in.forEach(function(neigh_ix) {
            nodes[neigh_ix].neigh_in
                .forEach(function(nn_ix)
                        { n.nn_in[nn_ix] = nn_ix; });
        });
        n.neigh_out.forEach(function(neigh_ix) {
            nodes[neigh_ix].neigh_out // Correct?
                .forEach(function(nn_ix) { n.nn_out[nn_ix] = nn_ix; });
        });
        n.nn_in  = obj_keys(n.nn_in).map(function(ix){return +ix;})
        n.nn_out = obj_keys(n.nn_out).map(function(ix){return +ix;})


        n.nn = n.nn_in.length + n.nn_out.length;
    });
    nodes.forEach(function(n, i) {
        if (nodes[max_nn].nn < n.nn) max_nn = i;
        if (nodes[min_nn].nn > n.nn) min_nn = i;
    });
    return {min: min_nn, max: max_nn,
            min_val: nodes[min_nn].nn, max_val: nodes[max_nn].nn,
            quantile: d3.scale.linear()
                .domain(d3.range(0, nodes[max_nn].nn, nodes[max_nn].nn/3))
                .interpolate(interpolateFloor)
                .range(d3.range(0,3)).clamp(true) };
}

function find_cc(nodes, links) {
    return [0,0];
}



function degrees(radians) {
    return radians / Math.PI * 180;
}



function obj_keys(obj) {
    keys = [];
    for (var i in obj)
        if (obj.hasOwnProperty(i))
            keys.push(i);
    return keys;
}



function interpolateFloor(a, b) {
  a = +a, b = +b;
  return function(t) { return Math.floor(a * (1 - t) + b * t); };
}


