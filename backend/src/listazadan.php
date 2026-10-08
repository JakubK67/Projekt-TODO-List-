<?php
    require_once __DIR__ . '/polaczenie.php';
    
    $nazwaProjektu = "Pierwszy projekt";
    $id_uzytkownika = 1;//$_SESSION['id_uzytkownika'];
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Zadania z <?php echo $nazwaProjektu; ?></title>
    <link rel="stylesheet" href="main.css">
</head>
<body>
    <nav>
        <a href="">Logowanie</a>
    </nav>
    <main>
        <div>
            <h1>Zadania z projektu <?php echo $nazwaProjektu; ?></h1>
            <div class="zadania">
                <?php
                    $kwerenda = "SELECT zadania.nazwa, zadania.opis, zadania.termin, zadania.priorytet, zadania.status FROM zadania INNER JOIN projekty ON projekty.id = zadania.id_projektu WHERE projekty.nazwa = ?;";
                    $stmt = mysqli_prepare($polaczenie, $kwerenda);
                    mysqli_stmt_bind_param($stmt, "s", $nazwaProjektu);
                    mysqli_stmt_execute($stmt);
                    
                    $wynik = mysqli_stmt_get_result($stmt);
                    while($wiersz = mysqli_fetch_assoc($wynik)){
                        $status = str_replace(' ', '-', $wiersz['status']);
                        echo '<div class="zadanie ' . $status . '">';
                        echo '<p class="nazwa">' . $wiersz['nazwa'] . '</p>';
                        echo '<p class="opis">' . $wiersz['opis'] . '</p>';
                        echo '<p class="termin">' . $wiersz['termin'] . '</p>';
                        echo '<p class="priorytet">' . $wiersz['priorytet'] . '</p>';
                        echo '<p class="status">' . $wiersz['status'] . '</p>';
                        echo '</div>';
                    }
                ?>
            </div>
        </div>
        <div class="dodajZadanie">
            <a href="dodajzadanie.html">Dodaj zadanie</a>
        </div>
    </main>

    <script type="module" src="/src/main.jsx"></script>
</body>
</html>