<?php
namespace App\Command;

use App\Service\Schema;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Output\OutputInterface;

#[AsCommand(name: 'app:database:init', description: 'Tworzy brakujące tabele bez usuwania danych')]
final class InitializeDatabaseCommand extends Command
{
    public function __construct(private Schema $schema)
    {
        parent::__construct();
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $this->schema->initialize();
        $output->writeln('Struktura bazy jest gotowa. Istniejące dane zostały zachowane.');
        return Command::SUCCESS;
    }
}
