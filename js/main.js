// This script creates a D3 choropleth map of Chicago neighborhoods

//begin script when window loads
window.onload = setMap();

//set up choropleth map
function setMap(){

    //map frame dimensions
    var width = 550,
    height = 600;

    //create new svg container for the map
    var map = d3.select("body")
        .append("svg")
        .attr("class", "map")
        .attr("width", width)
        .attr("height", height);

    //create Albers equal area conic projection centered on Chicago
    var projection = d3.geoAlbers()
        .center([0, 41.835])
        .rotate([87.7, 0, 0])
        .parallels([42, 41])
        .scale(75000)
        .translate([width / 2, height / 2]);
    
    var path = d3.geoPath()
    .projection(projection);

    //use Promise.all to parallelize asynchronous data loading
    var promises = [];    
    promises.push(d3.csv("data/chicagoData.csv")); //load attributes from csv    
    promises.push(d3.json("data/Illinois_Counties.topojson")); //load background IL spatial data
    promises.push(d3.json("data/Indiana_Counties.topojson")); //load background IN spatial data     
    promises.push(d3.json("data/chicagoNeighborhoodsSimp2pct.topojson")); //load choropleth spatial data
    promises.push(d3.json("data/chicagoMetroCities.topojson")); //load background spatial point data
    //Promise.all(promises).then(callback);
    Promise.all(promises).then(function(data) {
        callback(map, path, data, projection); 
});
}

// Set up callback function
function callback(map, path, data, projection) {
    var csvData = data[0],
        countiesIL = data[1],
        countiesIN = data[2],
        chicago = data[3],
        cities = data[4];
    console.log(csvData);
    console.log(countiesIL);
    console.log(countiesIN);
    console.log(chicago);
    console.log(cities);

    //translate TopoJSON polygons
        var chicagolandCounties = topojson.feature(countiesIL, countiesIL.objects.Illinois_Counties),
        indianaCounties = topojson.feature(countiesIN, countiesIN.objects.Indiana_Counties),
        chicagoNeighborhoods = topojson.feature(chicago, chicago.objects.ChicagoNeighborhoodsSimp2pct).features;
    //examine the results
    console.log(chicagolandCounties)
    console.log(indianaCounties)
    console.log(chicagoNeighborhoods);

    //create graticule generator
    var graticule = d3.geoGraticule()
    .step([5, 5]); //place graticule lines every 5 degrees of longitude and latitude

    //create graticule background
    var gratBackground = map.append("path")
        .datum(graticule.outline()) //bind graticule background
        .attr("class", "gratBackground") //assign class for styling
        .attr("d", path) //project graticule

    //create graticule lines
    var gratLines = map.selectAll(".gratLines") //select graticule elements that will be created
        .data(graticule.lines()) //bind graticule lines to each element to be created
        .enter() //create an element for each datum
        .append("path") //append each element to the svg as a path element
        .attr("class", "gratLines") //assign class for styling
        .attr("d", path); //project graticule lines
    
    //add Chicago metro IL counties to map
    var countiesIL = map.append("path")
    .datum(chicagolandCounties)
    .attr("class", "counties")
    .attr("d", path);

    //add Indiana's Lake County to map
    var countiesIN = map.append("path")
    .datum(indianaCounties)
    .attr("class", "countiesIN")
    .attr("d", path);
   
    //add Chicago neighborhoods to map
    var communities = map.selectAll(".communities")
    .data(chicagoNeighborhoods)
    .enter()
    .append("path")
    .attr("class", function(d){
        return "communities" + d.properties.community;})
    .attr("d", path);

   //add labels for Chicago area cities to map
    var metroCities = map.selectAll(".city-point")
   .data(topojson.feature(cities, cities.objects.pasted).features)
   .enter()
   .append("g")
   .attr("class", "city-group");
 
   //add circle points for city labels 
   metroCities.append("circle")
   .attr("class", "city-point")
   .attr("cx", function(d) { return projection(d.geometry.coordinates)[0]; })
   .attr("cy", function(d) { return projection(d.geometry.coordinates)[1]; })
   .attr("r", 3)
   .attr("fill", "grey");
 
   //add text for city labels
   metroCities.append("text")
   .attr("class", "place-label")
   .attr("class", function(d) {
    return "place-label " + (d.properties.City === "Chicago" ? "chicago-label" : "");
    }) // Create special label for Chicago
   .attr("x", function(d) {
     return d.geometry.coordinates[0] > -87.7 ? projection(d.geometry.coordinates)[0] + 5 : projection(d.geometry.coordinates)[0] - 5;
   }) // Adjust the horizontal offset from circle
   .attr("y", function(d) { return projection(d.geometry.coordinates)[1] + 7; }) // Adjust the vertical offset from circle
   .attr("dy", ".35em")
   .style("text-anchor", function(d) {
     return d.geometry.coordinates[0] > -87.7 ? "start" : "end";
   })
   .text(function(d) { return d.properties.City; });

}