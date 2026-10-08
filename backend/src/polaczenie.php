<?php
    session_start();
    $polaczenie = mysqli_connect("localhost", "root", "", "baza_danych");

    if(!$polaczenie){
        die("Blad polaczenia z baza");
        session_abort();
    }
?>