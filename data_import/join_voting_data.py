#! /bin/python

import json, csv, sys

geography = json.load(sys.stdin);

votes = {};

with open('../data/chester_county_votes.txt', 'r') as csvfile:

    csvreader = csv.reader(csvfile, delimiter=',')

    next(csvreader)

    for row in csvreader:
        votes[row[0]] = { 'republicans' : int(row[1].strip()), 'democrats': int(row[2].strip()) } 

for feature in geography['features']:
    key = feature['properties']['NAME10'].upper()

    if key in votes:
       feature['properties']['republicans'] = votes[key]['republicans'] 
       feature['properties']['democrats'] = votes[key]['democrats'] 

json.dump(geography, sys.stdout)

