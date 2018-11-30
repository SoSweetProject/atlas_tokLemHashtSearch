var myForm = document.getElementById('form');
var departements;
var stat = false;
var data;
var freq;
var specif;
var dep;
var defaultStyle = {
  weight: 1,
  color: '#77af75',
  fillColor: '#77af75',
  dashArray: '',
  fillOpacity: 0.3
}
var selectedStyle = {
  weight: 2,
  color: '#efefef',
  fillColor: '#d1d1d1',
  dashArray: '',
  fillOpacity: 0.3
}

// Mise en place de la carte
var map = L.map("map").setView([46.227638, 2.213749000000007], 6);
var mapboxAccessToken = 'pk.eyJ1Ijoic2F0aWxsb3ciLCJhIjoiY2prYjhsenI2Mnl2dDNycXFxdXQ1YWxpNyJ9.ah5XcUxTiKF4xWs8CKLPrQ';
L.tileLayer('https://api.tiles.mapbox.com/v4/{id}/{z}/{x}/{y}.png?access_token={accessToken}', {
  attribution: 'Map data &copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors, <a href="https://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, Imagery © <a href="https://www.mapbox.com/">Mapbox</a>',
  maxZoom: 8,
  minZoom: 6,
  id: 'mapbox.light',
  accessToken: mapboxAccessToken
}).addTo(map);

$.ajax({
  method: "POST",
  url: "departements.json",
  dataType: "json",
  success: function(response) {
    departements = L.geoJson(response, {
      onEachFeature: onEachFeature,
      style: getDefaultStyle
    });
    departements.addTo(map);
  }
});

function getDefaultStyle(e) {
  return defaultStyle;
}

function onEachFeature(feature, layer) {
  layer.on({
    click: reloadTable,
    mouseover: showdepartementPopup,
    mouseout: function(e) {
      map.closePopup()
    }
  });
}

// action effectuée au clic sur un département (chargement du tableau contenant les fréquences et spécificités de chaque unité (token, lemme ou hashtag) du département)
function reloadTable(e) {
  deleteInfos();
  dep = e.target.feature.properties.code;
  $unit = getUnit();
  departements.eachLayer(function(layer) {
    layer.setStyle(defaultStyle);
  })
  e.target.setStyle(selectedStyle);
  // exception pour les navigateurs ie, opera et edge
  if (!L.Browser.ie && !L.Browser.opera && !L.Browser.edge) {
    e.target.bringToFront();
  }
  document.getElementById('selectUnit').innerHTML = $unit.charAt(0).toUpperCase() + $unit.substring(1).toLowerCase() + "s";
  $("#caption").html("Specifities for <b>" + e.target.feature.properties.nom + "</b>");
  $.ajax({
    url: "specif.php?dpt=" + e.target.feature.properties.code + "&unit=" + $unit,
    type: "GET",
    dataType: "json",
    success: function(data) {
      data = $.makeArray(data);
      $("#table").DataTable().clear();
      $("#table").DataTable().rows.add(data).draw();
    },
  });
}

// Recharge le tableau en fonction lorsque l'unité sélectionnée change pour un département
function reloadUnit(unit) {
  if (dep) {
    deleteInfos();
    departements.eachLayer(function(layer) {
      layer.setStyle(defaultStyle);
    })
    document.getElementById('selectUnit').innerHTML = unit.charAt(0).toUpperCase() + unit.substring(1).toLowerCase() + "s";
    $.ajax({
      url: "specif.php?dpt=" + dep + "&unit=" + unit,
      type: "GET",
      dataType: "json",
      success: function(data) {
        data = $.makeArray(data);
        $("#table").DataTable().clear();
        $("#table").DataTable().rows.add(data).draw();
      },
    });
  }
}

// actions lors du survol des département (popup affichant le nom et le code du département + affichage de l'unité recherchée s'il y a lieu, ainsi que de sa fréquence et sa spécificité)
function showdepartementPopup(e) {
  var popup = L.popup()
    .setLatLng(e.latlng)
    .setContent(e.target.feature.properties.code + ' - ' + e.target.feature.properties.nom)
    .openOn(map);
  if (stat) {
    document.getElementById("stat").innerHTML = e.target.feature.properties.nom + " (" + e.target.feature.properties.code + ")";
    document.getElementById("freq").innerHTML = "<b><i>frequency</i> :</b> " + datas[e.target.feature.properties.code]["freq"];
    document.getElementById("specif").innerHTML = "<b><i>specificity</i> :</b> " + datas[e.target.feature.properties.code]["specif"].toFixed(4);
  }
}

function color(s) {
  colors = ['#053061', '#2166ac', '#4393c3', '#92c5de', '#d1e5f0', '#f7f7f7', '#fddbc7', '#f4a582', '#d6604d', '#b2182b', '#67001f'];
  return colors[parseInt((s + 10) / 2)]
}

// Légende de la carte
var legend = L.control({
  position: 'topright',
  id: 'legend'
});
legend.onAdd = function(map) {
  var div = L.DomUtil.create('div', 'info legend'),
    grades = [10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0, -1, -2, -3, -4, -5, -6, -7, -8, -9, -10];
  div.id = 'legend'
  div.innerHTML = "<b>Overused</b><br>";
  for (var i = 0; i < grades.length; i++) {
    div.innerHTML +=
      '<i style="background:' + color(grades[i]) + '"></i> ' +
      grades[i] + '<br>';
  }
  div.innerHTML += "<b>Underused</b>";
  return div;
};
legend.addTo(map);

// Initialisation du tableau
function initTable() {
  var table = $("#table").DataTable({
    columns: [{
        data: "word"
      },
      {
        data: "freq"
      },
      {
        data: "specif"
      },
    ],
    "pageLength": 20,
    "bLengthChange": false
  });
  // Comportement au clic sur une ligne du tableau (principalement, récupère les données associées à l'unité figurant sur la ligne et fait appel à mapWord() pour la coloration de la carte)
  $("#table tbody").on("click", "tr", function() {
    deleteInfos();
    var data = table.row(this).data();
    $wordToSearch = encodeURIComponent(data['word']);
    $unit = getUnit();
    $.ajax({
      type: "POST",
      url: "specif.php?wordToSearch=" + $wordToSearch + "&unit=" + $unit,
      dataType: "json",
      success: function(response) {
        $mapWord(response, $wordToSearch, $unit);
        datas = tojson(response.toSource());
        stat = true;
      }
    });
  });
}

// Comportement lorsqu'une recherche globale est faite (principalement, récupère les données associées à l'unité recherchée et fait appel à mapWord() pour la coloration de la carte)
function searchWord() {
  deleteInfos();
  $wordToSearch = document.getElementById("search").value;
  $unit = getUnit();
  $.ajax({
    type: "POST",
    url: "specif.php?wordToSearch=" + encodeURIComponent($wordToSearch) + "&unit=" + $unit,
    dataType: "json",
    success: function(response) {
      document.getElementById('search').value = "";
      if (response == "") {
        alert("Il n'existe aucune occurence du " + $unit + " \"" + $wordToSearch + "\".");
        departements.eachLayer(function(layer) {
          layer.setStyle(defaultStyle);
        })
      } else {
        $mapWord(response, $wordToSearch, $unit);
        datas = tojson(response.toSource());
        stat = true;
      }
    },
  });
}

// Supprime les informations affichées sur l'unité précédente
function deleteInfos() {
  document.getElementById("infos").innerHTML = "";
  document.getElementById("stat").innerHTML = "";
  document.getElementById("freq").innerHTML = "";
  document.getElementById("specif").innerHTML = "";
  stat = false;
}

// Récupère la valeur du bouton radio sélectionné
function getUnit() {
  var unit;
  if (document.getElementById("token").checked) {
    unit = document.getElementById("token").value;
  } else if (document.getElementById("lemma").checked) {
    unit = document.getElementById("lemma").value;
  } else {
    unit = document.getElementById("hashtag").value;
  }
  return unit;
}

// Coloration de la carte en fonction des spécificités
function $mapWord(values, wordToSearch, unit) {
  document.getElementById("infos").innerHTML = "Search result for the " + unit + " <b><i>" + wordToSearch + "<i/><b/>";
  departements.eachLayer(function(layer) {
    style = {
      fillColor: color(values[layer.feature.properties.code]["specif"]),
      weight: 2,
      opacity: 1,
      color: 'white',
      dashArray: '3',
      fillOpacity: 0.7
    };
    layer.setStyle(style);
  })
}

// Normalise les données récupérées pour qu'elles correspondent à du Json
function tojson(data) {
  var re = /((\d{2}|2A|2B)|freq|specif):/gi;
  var quote = /\'/gi;
  data = data.replace("\(", "");
  data = data.replace("\)", "");
  data = data.replace(re, "\'$1\':");
  data = data.replace(quote, "\"");
  data = JSON.parse(data);
  return data;
}

$(document).ready(initTable())

myForm.addEventListener('submit', function(e) {
  searchWord();
  e.preventDefault();
});
