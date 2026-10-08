<?php
    require_once __DIR__ . '/polaczenie.php';

    $nazwa = $_POST['nazwa'] ?? '';
    $priorytet = $_POST['priorytet'] ?? '';
    $termin = $_POST['termin'] ?? '';
    $opis = $_POST['opis'];
    $id_uzytkownika = 1; //$_SESSION['id_uzytkownika'];
    $id_projektu = 1; //$_SESSION['id_projektu'];

    if(empty($nazwa) || empty($priorytet) || empty($termin)){
        header("Location: dodajzadanie.html");
        exit;
    }

    $kwerenda = "INSERT INTO zadania(nazwa, opis, termin, priorytet, id_uzytkownika, id_projektu) VALUES(?, ?, ?, ?, ?, ?);";

    $stmt = mysqli_prepare($polaczenie, $kwerenda);
    mysqli_stmt_bind_param($stmt, "ssssii", $nazwa, $opis, $termin, $priorytet, $id_uzytkownika, $id_projektu);
    mysqli_stmt_execute($stmt);

    header("Location: listazadan.php");
?>