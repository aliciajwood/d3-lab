/* Stylesheet by Alicia Wood, 2022 */ 

//First line of main.js...wrap everything in a self-executing anonymous function to move to local scope
(function(){
    
//pseudo-global variables


// list of attributes to show in chloropleths 
var attrArray = {"SALARY_2020_2021":"Average Teacher Salary (2020-2021)", "GRAD_RATE_2018_2019":"Graduation Rates (2018-2019)", "STUDENTS_REL_COUNT_2020_2021": "# of Students Relative to Teachers (2020-2021)", "UNDERQUALIFIED": "# of Underqualified Teachers per 100,000 Students", "EXPENDITURES_2019_2020": "Expenditures per Student (2019-2020)"};
//list of all attributes (includes extra year field for labeling)
var attrArrayAll = {"SALARY_2020_2021":"Average Teacher Salary (2020-2021)", "GRAD_RATE_2018_2019":"Graduation Rates (2018-2019)", "STUDENTS_REL_COUNT_2020_2021": "# of Students Relative to Teachers (2020-2021)", "UNDERQUALIFIED": "# of Underqualified Teachers per 100,000 Students", "EXPENDITURES_2019_2020": "Expenditures per Student (2019-2020)","UNDERQUALIFIED_YEAR": "Underqualification Data Year"};

var attrKeys = Object.keys(attrArray); // version of attribute fields to include in dropdown (excludes extra fields)
var attrKeysAll = Object.keys(attrArrayAll); // version of attribute fields to include in geojson (includes extra year field for label box)

var expressed = attrKeys[0];
    
//chart frame dimensions
var chartWidth = window.innerWidth * 0.425,
    chartHeight = 563
    leftPadding = 40,
    rightPadding = 2,
    topBottomPadding = 5,
    chartInnerWidth = chartWidth - leftPadding - rightPadding,
    chartInnerHeight = chartHeight - topBottomPadding * 2,
    translate = "translate(" + leftPadding + "," + topBottomPadding + ")";

//begin script when window loads
window.onload = setMap();

//set up choropleth map
function setMap(){
    
    //map frame dimensions (then swapped out to be response and use % of width)
    var width = window.innerWidth * 0.5,
        height = 550;

    //create new svg container for the map
    var map = d3.select("body")
        .append("svg")
        .attr("class", "map")
        .attr("width", width)
        .attr("height", height);

    //create Albers equal area conic projection centered on continental US with separate Hawaii and Alaska insets
    var projection = d3.geoAlbersUsa()
        .scale(1050)
        .translate([width / 2, height / 2]);
    
    // create path generator with that projection, will apply it below to draw the geometries
    var path = d3.geoPath()
        .projection(projection);
    
    // ALTERNATIVE FUNCTIONS USED BELOW IN QUEUE BECAUSE OF D3 V5 COMPATIBILITY
    // https://stackoverflow.com/questions/49120879/d3-queue-only-produces-error
    // https://www.appsloveworld.com/d3js/100/10/using-d3-queue-with-d3-v5
    function getcsv(url, callback) {
        d3.csv(url).then(function (file){
            callback(null, file)
        })
    };
    function getjson(url, callback) {
        d3.json(url).then(function (file){
            callback(null, file)
        })
    };
    //use queue to parallelize asynchronous data loading
    d3.queue()
        // ORIGINAL FOR D3 V3 & V4
        //.defer(d3.csv, "data/EducationData.csv") //load attributes from csv
        //.defer(d3.json, "data/States.topojson") //load chloropleth spatial data
        // workaround FOR V5 (calls functions above)  
        .defer(getcsv,"data/EducationData.csv") //load attributes from csv
        .defer(getjson, "data/States.topojson") //load chloropleth spatial data
        .await(callback);
    
    function callback(error, csvData, statesData) {
        //console.log(csvData);
        
        //translate US states TopoJSON
        var usStates = topojson.feature(statesData, statesData.objects.States).features;
        //console.log(usStates);

        //join csv data to GeoJSON enumeration units (calls function below)
        usStates = joinData(usStates, csvData);
        //console.log(usStates);
        
        //create the color scale
        var colorScale = makeColorScale(csvData);

        //add enumeration units to the map (calls function below)
        setEnumerationUnits(usStates, map, path, colorScale);
        
        //add coordinated visualization to the map
        setChart(csvData, colorScale);
        
        createDropdown(csvData);
        
    };
}; // end of setMap()
    
// function for adding csvData attributes to usState geojson (called above in callback function)
function joinData(usStates, csvData){
    //variables to join into geojson from csv are stored in psuedo-global variable attrArray above

    //loop through csv to assign each set of csv attribute values to geojson state
    for (var i=0; i<csvData.length; i++){
        var csvState = csvData[i]; //the current state
        var csvKey = csvState.STUSPS; //the csv primary key

        //loop through geojson states to find correct state
        for (var a=0; a<usStates.length; a++){

            var geojsonProps = usStates[a].properties; //the current state geojson properties
            var geojsonKey = geojsonProps.STUSPS; //the geojson primary key

            //where primary keys match, transfer csv data to geojson properties object
            if (geojsonKey == csvKey){
                
                //ALTERNATIVE PROCESSING FOR EACH ATTRIBUTE SOURCING DICTIONARY INSTEAD
                //attrKeys.forEach(function(attrKey){  
                attrKeysAll.forEach(function(attrKey){
                    //the keys in the attrArray table are the actual attribute names we need
                    // UNDERQUALIFIED_YEAR needs to remain a string, rest convert to floats
                    if (attrKey == "UNDERQUALIFIED_YEAR"){
                        var val = csvState[attrKey]; //get csv attribute value (leave as string)
                        geojsonProps[attrKey] = val; //assign attribute and value to geojson properties
                    } else {
                        var val = parseFloat(csvState[attrKey]); //get csv attribute value (convert to float)
                        geojsonProps[attrKey] = val; //assign attribute and value to geojson properties
                    }0
                }); // end processing each attribute
            }; // end if keys match section
        }; // end states for loop
    }; // end csv for loop

    return usStates;
};
    
//function to create color scale generator (called above in callback function)
function makeColorScale(data){
    var colorClasses = [
        /*
        "#FFC890",
        "#FFA142",
        "#FF6107",
        "#D43000",
        "#9E1300"
        */
        "#A0D2E7",
        "#81B1D5",
        "#5C7EC3",
        "#26408B",
        "#0F084B"
    ];

    //create color scale generator
    var colorScale = d3.scaleThreshold()
        .range(colorClasses);

    //build array of all values of the expressed attribute
    var domainArray = [];
    for (var i=0; i<data.length; i++){
        var val = parseFloat(data[i][expressed]);
        domainArray.push(val);
    };

    //cluster data using ckmeans clustering algorithm to create natural breaks
    var clusters = ss.ckmeans(domainArray, 5);
    //reset domain array to cluster minimums
    domainArray = clusters.map(function(d){
        return d3.min(d);
    });
    //remove first value from domain array to create class breakpoints
    domainArray.shift();

    //assign array of last 4 cluster minimums as domain
    colorScale.domain(domainArray);

    return colorScale;
};
    
//function to test for data value and return color (called within setEnumerationUnits function)
function choropleth(props, colorScale){
    //console.log(props); // WORKS HERE
    //make sure attribute value is a number
    var val = parseFloat(props[expressed]);
    //if attribute value exists, assign a color; otherwise assign gray
    if (typeof val == 'number' && !isNaN(val)){
        return colorScale(val);
    } else {
        return "#CCC";
    };
};
    
// function for adding US states to map (called above in callback function)
function setEnumerationUnits(usStates, map, path, colorScale){
    var states = map.selectAll(".states")
        .data(usStates)
        .enter()
        .append("path")
        .attr("class", function(d){
            return "states " + d.properties.STUSPS;
        })
        .attr("d", path)
        .style("fill", function(d){
            return choropleth(d.properties, colorScale);
        })
        .on("mouseover",function(event, d){
            highlight(d.properties);
        })
        .on("mouseout", function(event, d){
            dehighlight(d.properties);
        })
        .on("mousemove", function(event){
            moveLabel(event);
        });
    
    //add style descriptor to each path (storing prior stroke style for use in dehighlight later to return to this)
    var desc = states.append("desc")
        .text('{"stroke": "#000", "stroke-width": "0.5px"}');
};
    
//function to create coordinated bar chart (called above in callback function)
function setChart(csvData, colorScale){
    
    //chart frame dimensions (initially set here but moved out to psuedo-global variables so could use again in the change attribute function for when users interact with the dropdown)
    
    //create a scale to size bars proportionally to frame (initially here but moved to pseudo-global variable section)

    //create a second svg element to hold the bar chart
    var chart = d3.select("body")
        .append("svg")
        .attr("width", chartWidth)
        .attr("height", chartHeight)
        .attr("class", "chart");
    
    //create a rectangle for chart background fill
    var chartBackground = chart.append("rect")
        .attr("class", "chartBackground")
        .attr("width", chartInnerWidth)
        .attr("height", chartInnerHeight)
        .attr("transform", translate);
    
    //set bars for each state
    var bars = chart.selectAll(".bars")
        .data(csvData)
        .enter()
        .append("rect")
        .sort(function(a, b){
            return b[expressed]-a[expressed]
        })
        .attr("class", function(d){
            //console.log(d.STUSPS);
            return "bars " + d.STUSPS;
        })
        .attr("width", chartInnerWidth / csvData.length - 1)
        .on("mouseover",function(event, d){
            highlight(d);
        })
        .on("mouseout",function(event, d){
            dehighlight(d);
        })
        .on("mousemove", function(event){
            moveLabel(event);
        });
    
    //add style descriptor to each rect
    var desc = bars.append("desc")
        .text('{"stroke": "none", "stroke-width": "0px"}');
    
    //create a text element for the chart title
    var chartTitle = chart.append("text")
        .attr("x", 60) // DETERMINE ALTERNATIVE FOR CENTERING OR RIGHT ALIGNING
        .attr("y", 40)
        .attr("class", "chartTitle")
        .text(attrArray[expressed]); // sets chart title based on initial default variable. need to change later to one selected in dropdown
    
    //get max value of attribute so can use in y scale
    var maxVal = d3.max(csvData, function(d) { return parseFloat(d[expressed]); });
    
    var yScale = createYScale(maxVal);
    
    //create vertical axis generator
    var yAxis = d3.axisLeft()
        .scale(yScale);
        //.orient("left"); outdated... d5 doesn't work?

    //place axis
    var axis = chart.append("g")
        .attr("class", "axis")
        .attr("transform", translate)
        .call(yAxis);

    //create frame for chart border
    var chartFrame = chart.append("rect")
        .attr("class", "chartFrame")
        .attr("width", chartInnerWidth)
        .attr("height", chartInnerHeight)
        .attr("transform", translate);
    
    //set bar positions, heights, and colors
    updateChart(bars, csvData.length, colorScale, maxVal, chart);
};

function createYScale(maxVal){
    //create a scale to size bars proportionally to frame
    var yScale = d3.scaleLinear()
        .range([chartInnerHeight, 0])
        .domain([0, maxVal + 0.1*maxVal]); // previously explicitly defined max #. But need to change based on attribute selected... and need to leave some space at the top of the chart hence the adding 1/10 to the maxvalue
    return yScale;
}
    
//function to create a dropdown menu for attribute selection (called above in callback function)
function createDropdown(csvData){
    //get bounds of map to base placement of the dropdown menu off of later
    var mapBounds = d3.select(".map")
        .node()
        .getBoundingClientRect();

    var x = mapBounds.left + 10;
    var y = mapBounds.top + 60;
    
    //add select element
    var dropdown = d3.select("body")
        .append("select")
        .attr("class", "dropdown")
        .style("left", x + "px")
        .style("top", y + "px")
        .on("change", function(){
            changeAttribute(this.value, csvData) //this.value is the element's attr value rather than attr text. Attr value contains the official attribute name (no spaces) while the text is what contains the better formated name (and is visible in the dropdown to users)
        });

    //add initial option
    var titleOption = dropdown.append("option")
        .attr("class", "titleOption")
        .attr("disabled", "true")
        .text("Select Attribute");
    
    //add attribute name options
    var attrOptions = dropdown.selectAll("attrOptions")
        .data(attrKeys)
        .enter()
        .append("option")
        .attr("value", function(d){ return d }) // assigns attribute value of actual field name
        .text(function(d){ return attrArray[d] }); // assigns text (what displays) of a better formatted version
};
    
//function for dropdown change listener handler (called above in createDropdown function)
// so when a new attribute is selected in the drop down... the "expressed" attribute parameter is changed to match it and then the color scale for the enumeration units is revised to match the new attribute.
function changeAttribute(attribute, csvData){
    //passed attribute the newly selected attr.value from the dropdown menu
    
    //change the expressed attribute
    expressed = attribute;

    //recreate the color scale
    var colorScale = makeColorScale(csvData);

    //recolor enumeration units
    var states = d3.selectAll(".states")
        .transition()
        .duration(1500)
        .style("fill", function(d){
            return choropleth(d.properties, colorScale)
        });

    //re-sort, resize, and recolor bars
    //identical copy and past from setchart parameters... so created separate function to call
    var bars = d3.selectAll(".bars")
        //re-sort bars
        .sort(function(a, b){
            return b[expressed] - a[expressed];
        })
        .transition() // adds animation to highlight the data has changed
        .delay(function(d,i){
            return i * 20 // delays each bars animation by 20 milliseconds each so they look like they are moving one by one to rearrange themselves
        })
        .duration(250); // gives each bar 1/2 second to complete the transition
    
    //get max value of attribute so can use in y scale later
    var maxVal = d3.max(csvData, function(d) { return parseFloat(d[expressed]); });
    
    var chart = d3.select(".chart");
        
    updateChart(bars, csvData.length, colorScale, maxVal, chart);
};
    
//function to position, size, and color bars in chart
function updateChart(bars, n, colorScale, maxVal, chart){
    /*
    //create a scale to size bars proportionally to frame
    var yScale = d3.scaleLinear()
        .range([chartInnerHeight, 0])
        .domain([0, maxVal + 0.1*maxVal]); // previously explicitly defined max #. But need to change based on attribute selected... and need to leave some space at the top of the chart hence the adding 1/10 to the maxvalue
    */
    var yScale = createYScale(maxVal);
    
    //position bars
    bars.attr("x", function(d, i){
            return i * (chartInnerWidth / n) + leftPadding;
        })
        //size/resize bars
        .attr("height", function(d){
            return chartInnerHeight - yScale(parseFloat(d[expressed]));
        })
        .attr("y", function(d){
            return yScale(parseFloat(d[expressed])) + topBottomPadding;
        })
        //color/recolor bars
        .style("fill", function(d){
            return choropleth(d, colorScale);
        });
    
    //create new vertical axis generator
    var yAxis = d3.axisLeft()
        .scale(yScale);
        //.orient("left"); outdated... d5 doesn't work?

    //replace axis based on new max value
    var axis = d3.select(".axis")
        .call(yAxis);

    //update chart title with new attribute name
    var chartTitle = d3.selectAll(".chartTitle")
        .text(attrArray[expressed]);
    
};
    
//function to create dynamic label
function setLabel(props){
    //formatted attribute name
    attrName = attrArray[expressed];
    
    if (expressed == "UNDERQUALIFIED"){
        schoolYear = props["UNDERQUALIFIED_YEAR"];
    } else {
        schoolYear = expressed.substr(-9,4) + "-" + expressed.substr(-4,4);
    };
    
    //modify label content dependent on format of attribute ($, %, etc)
    if (["SALARY_2020_2021","EXPENDITURES_2019_2020"].includes(expressed)){
        //csv is source for bar chart values and they are strings with decimals .00 so convert to float which removes these
        if (typeof(expressed)=== "string"){
            value = parseFloat(props[expressed]);
        } else {
            value = props[expressed];
        }
        var labelAttribute = "<h1>" + "$"+ value +
        "</h1><b>" + attrName + "</b>";
    } else if (["GRAD_RATE_2018_2019"].includes(expressed)){
        var labelAttribute = "<h1>" + props[expressed] + "%" +
        "</h1><b>" + attrName + "</b>";  
    } else {
        var labelAttribute = "<h1>" + props[expressed] +
        "</h1><b>" + attrName + "</b>";
    };

    //create info label div
    var infolabel = d3.select("body")
        .append("div")
        .attr("class", "infolabel")
        .attr("id", props.STUSPS + "_label")
        .html(labelAttribute);

    var stateName = infolabel.append("div")
        .attr("class", "labelname")
        .html(props.STATE);
};
    
//function to move info label with mouse
function moveLabel(event){
    //get width of label
    var labelWidth = d3.select(".infolabel")
        .node()
        .getBoundingClientRect()
        .width;
    
    var x1 = event.clientX + 10,
        y1 = event.clientY - 75,
        x2 = event.clientX - labelWidth - 10,
        y2 = event.clientY + 25;
    
    //horizontal label coordinate, testing for overflow
    var x = event.clientX > window.innerWidth - labelWidth - 20 ? x2 : x1; 
    //vertical label coordinate, testing for overflow
    var y = event.clientY < 75 ? y2 : y1; 

    d3.select(".infolabel")
        .style("left", x + "px")
        .style("top", y + "px");
};
    
//function to highlight enumeration units and bars
function highlight(props){
    //change stroke
    var selected = d3.selectAll("." + props.STUSPS)
        .style("stroke", "#ffa142")
        .style("stroke-width", "3");
    
    setLabel(props);
};

//function to reset the element style on mouseout
function dehighlight(props){
    // selects elements with class of the state code (ex: CA) ... so applies to both map items and chart bar items
    var selected = d3.selectAll("." + props.STUSPS) 
        .style("stroke", function(){
            return getStyle(this, "stroke")
        })
        .style("stroke-width", function(){
            return getStyle(this, "stroke-width")
        });

    function getStyle(element, styleName){
        var styleText = d3.select(element)
            .select("desc")
            .text();

        var styleObject = JSON.parse(styleText);

        return styleObject[styleName];
    };
    
    //remove info label
    d3.select(".infolabel")
        .remove();
};

function getKeyByValue(object, value) {
  return Object.keys(object).find(key => object[key] === value);
}
    
})(); //last line of main.js