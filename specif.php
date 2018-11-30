<?php
  if ($_GET['dpt']) {
    $dpt = $_GET['dpt'];
    $unit = $_GET['unit'];
    $freq = "freq_".$unit.".\"".$dpt."\"";
    $specif = "specif_".$unit.".\"".$dpt."\"";
    $wordF="freq_".$unit.".\"index\"";
    $wordS="specif_".$unit.".\"index\"";
    $db = new SQLite3('specif.db');
    // Récupération de chaque unité (token, lemme ou hashtag) du département avec leur fréquence et spécificité
    $sql = "select ".$wordF." as word, ".$freq." as freq, ".$specif." as specif from freq_".$unit." inner join specif_".$unit." on ".$wordF."  = ".$wordS." where ".$freq.">1 and ".$wordF." not LIKE '@%'  and ".$wordF." not LIKE '#%'";
    $ret = $db->query($sql);
    $row = $ret->fetchArray(SQLITE3_ASSOC);
    // ce qu'on récupère au final est de la forme : [{"word":word,"freq":freq,"specif":specif},{"word":word2,"freq":freq2,"specif":specif2},etc.]
    echo "[".json_encode($row);
    while ($row = $ret->fetchArray(SQLITE3_ASSOC)) {
      echo ",".json_encode($row);
    }
    echo "]";
    $db->close();
  }

  if ($_GET["wordToSearch"]) {
    $wordToSearch = $_GET['wordToSearch'];
    $wordToSearch = str_replace("\"", "\"\"", $wordToSearch);
    $unit = $_GET['unit'];
    $db = new SQLite3('specif.db');
    $tabWord = array();
    // Récupération des fréquences de l'unité (token, lemme ou hashtag)
    $sqlFreq = "SELECT * FROM freq_".$unit." WHERE \"index\"=\"".$wordToSearch."\"";
    $retFreq = $db->query($sqlFreq);
    $rowFreq = $retFreq->fetchArray(SQLITE3_ASSOC);
    foreach ($rowFreq as $cle=>$valeur) {
      if ($cle!="index") {
        $tabWord[$cle]["freq"]=$valeur;
      }
    }
    // Récupération des spécificités de l'unité (token, lemme ou hashtag)
    $sqlSpecif = "SELECT * FROM specif_".$unit." WHERE \"index\"=\"".$wordToSearch."\"";
    $retSpecif = $db->query($sqlSpecif);
    $rowSpecif = $retSpecif->fetchArray(SQLITE3_ASSOC);
    foreach ($rowSpecif as $key => $value) {
      if ($key!="index") {
        $tabWord[$key]["specif"]=$value;
      }
    }
    $db -> close();
    // $tabword est de la forme : {"dep":{"freq":freq,"specif":specif},"dep2":{"freq":freq2,"specif":specif2},etc.}
    echo json_encode($tabWord);
  }
?>
