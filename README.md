# Simple demo of gerrymandering for Associated Press

Hosted at https://gerrymandr.github.io/ap-demo/


### Contributors:

* Sam Stewart sams@umn.edu @samstewart
* Alex Gutierrez alexg@umn.edu
* Michael Altmann michael.altmann@gmail.com
* Nina Amenta  amenta@cs.ucdavis.edu

We use D3 for the front end and QGis, Python and PostGis for data maniulation

Starting with U.S. congressional districts in Lancaster, Delaware, Chester, Montgomery, and Berks counties, PA.
  Really starting with Chester county. 
  
  2010 Census
  2016 Election. Election data pulled from: https://github.com/openelections/openelections-data-pa
  
```County code data:
  Chester    --- 15
  Delaware   --- 23
  Lancaster  --- 36
  Montgomery --- 46
    (source: https://github.com/openelections/openelections-data-pa)
```

County FP10 Codes
```
Chester 29
Delaware 45
Lancaster 71
Montgomery 91
Berks  11
```

## Data and Sources

### Shapefile of entire area of interest.
County shapefile is in
```
data/Penn County
```

Retrieved from

https://github.com/aaron-strauss/precinct-shapefiles/blob/master/pa/2011_pa_precincts.zip

Used QGIS to select just a single county and
save it as a separate geojson.


### Shapefile and demographics for each MCDS

Complete MCDS shapefile is in
```
data/Penn MCDS Data
```
with subfolder for subsets by county.

Retrieved from

https://github.com/aaron-strauss/precinct-shapefiles/blob/master/pa/2011_pa_precincts.zip

Used QGIS to select data for a single county and
save it as a separate geojson.

Used the topojson-server node.js package to 
convert geojson to topojson.

You could also use http://mapshaper.org/

### Election returns by MCDS
```
data/chester_county_votes.txt
```

###  Data processing steps

Obtain election results from https://github.com/openelections/openelections-data-pa
Note that for each location, there are separate rows for each candidate
Import into QGIS as a delimited file with no spatial information

Use GroupStats to create a layer with
```
name_upper,idIfPossible,democrats,republicans
```

Obtain shapefile with demographics from
https://github.com/aaron-strauss/precinct-shapefiles

Load into QGIS

Create a new String column of width 100 NAME_UPPER = upper(NAME10)

Join spatial layer with voting data layer on NAME_UPPER

As desired, filter by county ID.

Export as geojson

Use 
```
geo2topo -o geo_and_votes.topojson geo_and_votes.geojson 
```


### Adjacency matrix for MCDS (old)
Computed in PostGIS from MCDS shape files
```
create table "PA_MCDS_graph" as
SELECT a."GEOID10" AS "GEOID101", b."GEOID10" AS "GEOID102",
    ST_GeometryType(ST_Intersection(a.geom, b.geom)),
    ST_MakeLine(ST_PointOnSurface(a.geom), ST_PointOnSurface(b.geom)) AS geom
FROM "PA_MCDS" AS a LEFT OUTER JOIN "PA_MCDS" AS b
ON a."GEOID10" < b."GEOID10"
AND a.geom && b.geom AND ST_Touches(a.geom, b.geom)
AND ST_GeometryType(ST_Intersection(a.geom, b.geom)) not in ('ST_Point', 'ST_MultiPoint')
```


### To start HTTP server:
If you are a developer hosting these files locally, you
will need to serve them up from a web server. It doesn't
matte rth etechnology, but for Python, here are the instructions.

For python < 3:
```
python -m SimpleHTTPServer
```
For python >= 3
```
python -m http.server
```
