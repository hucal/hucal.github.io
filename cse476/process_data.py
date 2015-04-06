import sys
import csv
import json


def csv_to(converter, fname, directory):
    """
    Takes a location to a CSV file and a directory name (pre-existing).
    Groups CSV rows by 'SPLIT_IX' and writes each of these groups to a new
    CSV file in 'directory'. Row groups should be independent.
    """
#    SPLIT_IX = 2 # column by which to split CSV into multiple CSV files
#    csvs = {}
#    header = ''
    with open(fname, 'rU') as f:
        csvreader = csv.reader(f, delimiter='\t', quoting=csv.QUOTE_NONE)
        header = csvreader.next()
        converter(csvreader, header, fname, directory)
#        for row in csvreader:
#            if csvs.get(row[SPLIT_IX]) is None:
#                csvs[row[SPLIT_IX]] = [row]
#            else:
#                csvs[row[SPLIT_IX]].append(row)

    # write_csvs(csvs, header, fname, directory)
    # converter(csvs, header, fname, directory)

def regulon_json_converter(csvs, header, fname, output):
    nodes = []
    links_tmp = []

    target_ix = header.index('RI_FIRST_GENE_ID')
    source_ix = header.index('SITE_ID')
    for row in csvs:
        source = row[source_ix]
        target = row[target_ix]
        source_data = {'name': source, 'outdeg': 0, 'indeg': 0, 'deg':0}
        target_data = {'name': target, 'outdeg': 0, 'indeg': 0, 'deg':0}
        links_tmp.append({'target': target, 'source': source})
        if not target_data in nodes:
            nodes.append(target_data)
        if not source_data in nodes:
            nodes.append(source_data)

    def get_name(o):
        return o['name']
    def ix_with(l, x, f):
        for pos, t in enumerate(l):
            if f(t) == x:
                return pos
        raise ValueError("list.index(x): x not in list")

    links = []
    for l in links_tmp:
        t_ix = ix_with(nodes, l['target'], get_name)
        s_ix = ix_with(nodes, l['source'], get_name)
        nodes[s_ix]['outdeg'] += 1
        nodes[t_ix]['indeg'] += 1
        links.append({ 'target': t_ix, 'source': s_ix })

    max_deg = 0
    for n in nodes:
        n['deg'] = n['outdeg'] + n['indeg']
        if n['deg'] > max_deg:
            max_deg = n['deg']
    print 'max_deg', max_deg
    print 'nodes, edges', len(nodes), len(links)

    json_data = {'nodes': nodes, 'links': links}
    print 'writing file', output
    with open(output, 'w') as new_json:
        new_json.write(json.dumps(json_data,
                  indent=1, separators=(',', ':')))


# def cow_json_converter(csvs, header, fname, directory):
#     """
#     Every group of rows is treated as a graph
#     Graph nodes are identified by 'node_id', this columnn is used as a key
#     in the creation of the 'node_dict' dictionary. Values include all rows
#     identified by 'node_id'
#     """
#     node_id = 'ccode1'
#     sum_columns = ['flow1', 'flow2']
#     node_id_ix = header.index(node_id)
#
#     for ix in csvs:
#         node_dict = {}
#         for row in csvs[ix]:
#             obj = {}
#             for i in range(len(header)):
#                 if i != node_id_ix:
#                     obj[header[i]] = row[i]
#             sums = [(lambda x: 0 if x < 0 else x)
#                     (float(row[header.index(col)]))
#                     for col in sum_columns]
#
#             if node_dict.get(row[node_id_ix]) is None:
#                 node = { 'links': [obj] }
#                 node_dict[row[node_id_ix]] = node
#                 for i in range(len(sum_columns)):
#                     node[sum_columns[i] + '_total'] = sums[i]
#             else:
#                 node = node_dict[row[node_id_ix]]
#                 node['links'].append(obj)
#                 for i in range(len(sum_columns)):
#                     node[sum_columns[i] + '_total'] += sums[i]
#
#         json_data = {'nodes': [], 'links': []}
#         for node_key in node_dict:
#             obj = {'ccode1': node_key, 'links': node_dict[node_key]['links']}
#             for col in sum_columns:
#                 obj[col + '_total'] = node_dict[node_key][col + '_total']
#             json_data['nodes'].append(obj)
#
#         # sort nodes on dict key 'ccode1'
#         def get_ccode1(obj):
#             return obj['ccode1']
#
#         nodes_len = len(json_data['nodes'])
#
#         json_data['nodes'].sort(key=get_ccode1)
#         def binary_find(ccode1):
#             min = 0
#             max = nodes_len
#             while True:
#                 if max < min:
#                     print "COUNTRY CODE NOT FOUND", ccode1
#                     return -1
#
#                 ix = (min + max) // 2
#                 if json_data['nodes'][ix]['ccode1'] < ccode1:
#                     min = ix + 1
#                 elif json_data['nodes'][ix]['ccode1'] > ccode1:
#                     max = ix - 1
#                 else:
#                     return ix
#
#
#
#         # create links array (based on node indices in nodes array) for D3
#         for obj_ix in range(nodes_len):
#             obj = json_data['nodes'][obj_ix]
#             for link in obj['links']:
#                 if float(link['flow1']) < 0:
#                     continue
#                 other_ix = binary_find(link['ccode2'])
#                 if other_ix < 0:
#                     continue
#
#                 json_data['links'].append({
#                     'source': obj_ix,
#                     'target': other_ix
#                     })
#
#
#         fname = directory + '/' + ix + '.json'
#         print 'writing file', fname
#         with open(fname, 'w') as new_json:
#             new_json.write(json.dumps(json_data, sort_keys=True,
#                       indent=4, separators=(',', ': ')))
#
#
# def csvs_converter(csvs, header, fname, directory):
#     for ix in csvs:
#         with open(directory + '/' + ix + '.csv', 'w') as new_csv:
#             for row in [header] + csvs[ix]:
#                 new_csv.write(','.join(row) + '\n')


if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit('Usage: %s cow_trade_csv_file output_directory'
        % sys.argv[0])

    csv_to(regulon_json_converter, sys.argv[1], sys.argv[2])
