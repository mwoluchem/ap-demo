/** Global constants */
var pi = Math.PI,
    tau = 2 * pi;
var projection, geoGenerator;
var nDistricts = 3
var oversizeThreshold = 1.05;  // 5% over even population
// Name of the overall objects
// in the topojson file
var mainTopology = "Chester"
var datafile = "data/Penn VTD Data/Chester/Chester.topojson"
// Names of fields in the geojson
var populationField = "POPULATION"
var democratsField = "PRES04_DEM"
var republicansField = "PRES04_REP"
// Colors for each user-assigned district
var districtColors = ["green", "orange", "rgb(200, 60, 200)"]
// Number of empty areas to
// examine for possible assignment
// each time the user clicks "Fill"
var fillRate = 30;

var minLightness = 40;
var width = 600,
    height = 600;


/** Variables determined when data are first loaded */
var maxBias = 0
var maxDemocratBias = 0
var maxRepublicanBias = 0
var totalPopulation = 0;
// Desired population for each district
var targetPopulation = 0;

var topology = null;
var expander = null;
var features = null;
var geojson = null;
var geometries
var propertiesById = {};

/** Variables that changes from user interactions */
var nAssignedDistricts = 0
var districtPopulation = [0, 0, 0]
var districtDemocrats = [0, 0, 0]
var districtRepublicans = [0, 0, 0]

// To which district are we currently assigning areas
var currentDistrictBrush = 0
// Is the mouse down
var dragging = false;



var svg = d3.select("#mapSvg")
    .attr("width", width)
    .attr("height", height);



// Main startup
loadData();

function loadData() {
    d3.json(datafile, function (error, topo) {
        topology = topo;
        geojson  = topojson.feature(topology, topology.objects[mainTopology]);
        geometries = topology.objects[mainTopology].geometries
        features  = geojson.features;
        for (var i=0; i< features.length; i++) {
            var id = features[i].properties.NAME10
            geometries[i].id = id
            propertiesById[id] = features[i].properties
        }
        expander = new SimpleExpander(topology);
        initializePopulation();
        initializeVoteCounts()
        initMap();
        resetDistricts();
    });
}

/** 
 * Set all area assignments
 * back to inital state. 
*/
function resetDistricts() {
    nAssignedDistricts = 0
    districtPopulation = [0, 0, 0]
    districtDemocrats = [0, 0, 0]
    districtRepublicans = [0, 0, 0]
    // To which district are we currently assigning areas
     currentDistrictBrush = 0
    // Is the mouse down
     dragging = false;  
    for (var i = 0; i < features.length; i++) {
        var feature = features[i];
        feature.properties.district = null;
        refreshMap(i);
    }        
    refreshScores();
    refreshPalette();
    initBorder();
    d3.select("#summary").text("")        
    
        
}

function doExpand() {
    expander.expand(fillRate);
}
function maskMouseOver() {
    dragging = false;
}



function changeElection() {
    var selector = d3.select("#electionSelector")
    var selectedElection = selector.property('value')
    
    democratsField = selectedElection + "_DEM"
    republicansField = selectedElection + "_REP"
    initializeVoteCounts()
    resetDistricts()
    initMap()
}

function initBorder() {
    // Find the outer border of all the areas
    // Note that this assumes to 
    var border = topojson.merge(topology, 
        topology.objects[mainTopology].geometries);
    d3.select("#mapSvg")
        .select('#border')
        .append('path')
        .datum(border)
        .style("stroke", "black")
        .style("stroke-width", 4)
        .style("fill", "none")
        .style("opacity", "1.0")
        .attr('d', geoGenerator)
}
// Compute total population
// and therefore desired population
// per district
function initializePopulation() {
    totalPopulation = 0;
    targetPopulation = 0;

    for (var i = 0; i < features.length; i++) {
        var feature = features[i];
        totalPopulation += feature.properties[populationField]
        
    }
    targetPopulation = totalPopulation / nDistricts;
}

function initializeVoteCounts() {
    var totalDems = 0;
    var totalReps = 0;
    for (var i = 0; i < features.length; i++) {
        var feature = features[i];
        var dems = feature.properties[democratsField]
        var reps = feature.properties[republicansField]
        if ((dems != null) && (reps != null)) {
            maxBias = Math.max(maxBias, Math.abs(dems - reps))
            maxDemocratBias = Math.max(maxBias, dems - reps)
            maxRepublicanBias = Math.max(maxBias, reps - dems)
            totalDems += dems;
            totalReps += reps;
        }   
    }
    console.log("dems:" + totalDems + " reps:"+totalReps + " percent dem:" + Math.round(100* (totalDems/(totalDems+totalReps)) ))    
}

// Assign an area to a district
function assignToDistrict(feature, district) {
    if (district == feature.properties.district) return;
    var pop = feature.properties[populationField]
    var dems = feature.properties[democratsField]
    var reps = feature.properties[republicansField]
    if (feature.properties.district != null) {
        districtPopulation[feature.properties.district] -= pop
        if ((dems != null) && (reps != null)) {
            districtDemocrats[feature.properties.district] -= dems
            districtRepublicans[feature.properties.district] -= reps
        }
    } else {
        nAssignedDistricts ++;       
    }
    feature.properties.district = district
    districtPopulation[feature.properties.district] += pop
    if ((dems != null) && (reps != null)) {
        districtDemocrats[feature.properties.district] += dems
        districtRepublicans[feature.properties.district] += reps
    }
    refreshScores();
    if (nAssignedDistricts == features.length) {
        showSummary();
    }
}


function showSummary() {
    var message = "Congratulations.  You assigned all the precincts to districts."
    d3.select("#summary").text(message)        
    
}

function selectColor(feature, i) {
    var district = feature.properties.district
    if (district != null) return "";
    else {
        var dems = feature.properties[democratsField]
        var reps = feature.properties[republicansField]
        if (dems > reps) {
            var hue = 240 //blue
            var saturation = 70
            var lightness = 100 - Math.trunc(minLightness * (dems - reps) / maxBias)
        } else {
            var hue = 0 //red
            var saturation = 70
            var lightness = 100 - Math.trunc(minLightness * (reps - dems) / maxBias)
        }
        var color = "hsl(" + hue + "," + saturation + "%," + lightness + "% )"
        return color
    }
}

// Refresh D3 binding
// between features and map areas
function initMap() {
    projection = d3.geoMercator()
        .fitSize([width, height], geojson);    

    geoGenerator = d3.geoPath()
        .projection(projection);


    // Build background tiles
    var tiles = d3.tile()
        .size([width, height])
        .scale(projection.scale() * tau)
        .translate(projection([0, 0]))
        ();

    d3.select("#mapSvg")
        .select("#images").selectAll("image")
        .data(tiles)
        .enter()
        .append("image")
        .attr("xlink:href", function (d) { return "http://" + "abc"[d[1] % 3] + ".tile.openstreetmap.org/" + d[2] + "/" + d[0] + "/" + d[1] + ".png"; })
        .attr("x", function (d) { return (d[0] + tiles.translate[0]) * tiles.scale; })
        .attr("y", function (d) { return (d[1] + tiles.translate[1]) * tiles.scale; })
        .attr("width", tiles.scale)
        .attr("height", tiles.scale);


    // Build vectors for each voting areas
    d3.select("#mapSvg")
        .select('#areas').selectAll("path")
        .data(features)
        .attr('d', geoGenerator)        
        .enter()
        .append('path')
        .attr("id", function (d, i) {
            // give each division an id
            return "division" + i
        })
        .attr('d', geoGenerator)        
        .attr("class", function (d, i) {
            // Get the district that has been assigned by the user
            // Should be a zero-based number
            // or missing for unassigned areas
            var district = d.properties.district
            // Use that to determine the area's style
            if (district != null) return "district" + district;
            else return "unassigned"
        })
        .style("stroke", "rgb(200, 200, 200)")
        .style("stroke-width", 1)
        .style("fill", selectColor)
        .on("mousedown", function (e, i) {
            if (features[i].properties.district != null) {
                currentDistrictBrush = features[i].properties.district
                refreshPalette();
            } else {
                assignToDistrict(features[i], currentDistrictBrush)
                refreshMap(i);
            }
            dragging = true;
        })
        .on("mouseup", function (e, i) {
            dragging = false;
        })
        .on("mouseenter", function (e, i) {
            if (dragging) {
                assignToDistrict(features[i], currentDistrictBrush)
                refreshMap(i);
                refreshPalette();
            }

        }).append("svg:title")
        .text(function (d, i) {
            var feature = features[i]
            var name = feature.properties.NAME10
            pop = feature.properties.POPULATION
            var dems = feature.properties[democratsField]
            var reps = feature.properties[republicansField]
            if (reps > dems) return  name + " R+" + Math.round(reps - dems)
            else return  name + " D+" + Math.round(dems - reps)
        })


}

var selectedCartogramProperty
function changeCartogram() {
    var selector = d3.select("#cartogramSelector")
     selectedCartogramProperty = selector.property('value')
    if (selectedCartogramProperty == "") {
        // Revert to natural boundaries
        initMap()
    } else {
        showCartogram()
    }  
}

/**
 * @returns A non-negative value indicating the relative size
 * of the precinct on the cartogram
 * @param {a geometry or feature of one precinct} d 
 */
function cartogramScore(d) {
    var properties = d.properties ? d.properties : propertiesById[d.id]
    var score
    if (selectedCartogramProperty == "POPULATION")  {
        score =  properties[populationField];
    } else if (selectedCartogramProperty == "EXCESS_DEMS") {
        var dems = properties[democratsField]
        var reps = properties[republicansField]
        score =  dems - reps
    } else if (selectedCartogramProperty == "EXCESS_REPS") {
        var dems = properties[democratsField]
        var reps = properties[republicansField]
        score = reps - dems 
    } else {
        score = 1
    } 
    return score
}

function showCartogram() {
    d3.select("#summary").text("processing...")
    var precincts = d3.select("#mapSvg")
    .select('#areas').selectAll("path")

    var values = precincts.data()
    .map(cartogramScore)
    .filter(function(n) {
      return !isNaN(n);
    })
    .sort(d3.ascending)
    var lo = values[0],
    hi = values[values.length - 1];
    
    var scale = d3.scaleLinear()
    .domain([lo, hi])
    .range([1, 1000]);

    carto = d3.cartogram()
    .projection(projection)
    .properties(function (d) {
        return propertiesById[d.id]
    })
    .value(function(d) {
         return scale(cartogramScore(d));
    });
 
  
    var newFeatures = carto(topology, geometries).features;
    precincts
    .data(newFeatures)
    .transition()
    .duration(750)
    .ease(d3.easeLinear)
    .attr('d', carto.path)
    d3.select("#summary").text("")
    
}
// Refresh D3 binding
// for one division
function refreshMap(division) {
    d3.select('#division' + division)
        .attr("class", function (d, i) {
            var district = d.properties.district
            // Use that to determine the area's style
            if (district != null) return "district" + district;
            else return "unassigned"
        })
        .style("fill", selectColor)
}

// Refresh D3 binding between
// the districts and the palette
function refreshPalette() {
    d3.select("#scoreSvg")
        .selectAll('.targetpop')
        .data(districtColors)
        .style("stroke-width", function (d, i) {
            if (i == currentDistrictBrush) return 8;
            else return 3;
        })
}

// Refresh D3 binding between districts
// and their scores
function refreshScores() {
    // Colored border for each fill tank
    d3.select("#scoreSvg")
        .selectAll('.targetpop')
        .data(districtPopulation)
        .enter()
        .append('rect')
        .attr("class", "targetpop")
        .attr("x", function (d, i) { return 12 + 44 * i })
        .attr("y", "29")
        .attr("width", "30")
        .attr("height", "100")
        .style("fill", "white")
        .style("stroke-width", 3)
        .style("stroke", function (d, i) {
            return districtColors[i];
        })
        .on("click", function (e, i) {
            currentDistrictBrush = i;
            dragging = false;
            refreshPalette()
        })
    var nOversized = 0;
    for (var d=0; d< nDistricts; d++) {
        if ( (districtPopulation[d] / targetPopulation ) > oversizeThreshold ) nOversized ++;
    }
    if (nOversized == 0) {
        d3.select("#overflowWarning").style("visibility","hidden")
    } else {
        d3.select("#overflowWarning").style("visibility","")        
    }
    d3.select("#scoreSvg")
        .selectAll('.fraction')
        .data(districtPopulation)
        .attr("height", function (d, i) { return 100 * districtPopulation[i] / targetPopulation })
        .attr("y", function (d, i) { return 25+ 4+ 100 - (100 * districtPopulation[i] / targetPopulation) })
        .enter()
        .append('rect')
        .attr("class", "fraction")
        .attr("x", function (d, i) { return 12 + 44 * i })
        .attr("width", "30")
        .style("fill", function (d, i) {
            return districtColors[i];
        })

    // For each 

    var predictedWinners = d3.select("#scoreSvg")
        .selectAll('.predictedWinner')
        .data(districtDemocrats)
        .style("fill", function (d, i) {
            var dems = districtDemocrats[i];
            var reps = districtRepublicans[i];
            if (dems) {
                if (reps) {
                    if (dems > reps) return "blue"
                    else return "red"
                } else {
                    return "blue"
                }
            } else {
                return "gray"
            }
        })
        .text(percentageText)
        .enter()
        .append('text')
        .attr("class", "predictedWinner")
        .attr("height", 20)
        .attr("y", 154)
        .attr("x", function (d, i) { return 10 + 44 * i })
        .attr("width", "44")
        .style("font-family", "monospace")
        .text(percentageText)

}

function percentageText(d, i) {
    var dems = districtDemocrats[i];
    var reps = districtRepublicans[i];
    if (dems) {
        if (dems > reps) return "" + Math.round(100 * dems / (dems + reps)) + "%"
        else return "" + Math.round(100 * dems / (dems + reps)) + "%"
    } else {
        return "  --"
    }
}

