<?php

namespace Bolt\Extension\GTaRR\PdfRenderer;

use Bolt\Asset\File\JavaScript;
use Bolt\Asset\File\Stylesheet;
use Bolt\Extension\SimpleExtension;
use Bolt\Filesystem\FilesystemInterface;
use Silex\Application;
use Silex\ControllerCollection;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\VarDumper\VarDumper;
use Twig\Error\Error;

/**
 * ExtensionName extension class.
 *
 * @author Vladimir Sushilov <mr.sushiloff@yandex.ru>
 */
class PdfRendererExtension extends SimpleExtension
{
    /**
     * {@inheritdoc}
     */
    protected function registerAssets()
    {
        // Add some web assets from the web/ directory
        return [
            new Stylesheet('nouislider.min.css'),
            new Stylesheet('extension.css'),
            new JavaScript('nouislider.min.js'),
            new JavaScript('extension.js'),
        ];
    }

    /**
     * {@inheritdoc}
     */
    protected function registerTwigFunctions()
    {
        return [
            'imagesFromPDF' => 'imagesFromPDF',
        ];
    }

    /**
     * {@inheritdoc}
     */
    protected function registerTwigPaths()
    {
        return [
            'templates' => ['position' => 'prepend', 'namespace' => 'bolt'],
        ];
    }

    /**
     * The callback function when {{ imagesFromPDF() }} is used in a template.
     *
     * @return string
     */
    public function imagesFromPDF($record = null)
    {
        $app = $this->getContainer();

        if (empty($record)) {
            $vars = $app['twig']->getGlobals();
            if (isset($vars['record'])) {
                $record = $vars['record'];
            }
        }

        if (!$record) return;

        $content = $record->values['body'];
        preg_match("#.*?<a.*\/files\/([^\"]*\.pdf)[-\"\\' =:;,><«»() . +?–— & ’ % \/А - Яа - я\w\d\t\s]*#", $content, $matches);

        $firstPdfPath = $matches[1];

        if (!$firstPdfPath) return;

        /** @var \Bolt\Filesystem\Manager $manager */
        $manager = $app['filesystem'];

        /** @var \Bolt\Filesystem\FilesystemInterface $filesystem */
        $filesystem = $manager->getFilesystem('files');

        /** @var \Bolt\Filesystem\Handler\FileInterface $file */
        $file = $filesystem->getFile($firstPdfPath);

        if (!$file->exists()) return;

        $images = $this->convertImages($firstPdfPath);

        $context = [
            'pdf_images_count' => count($images),
            'images' => $images
        ];

        return $this->renderTemplate('pdf_images.twig', $context);
    }

    public function convertImages($file)
    {
        $convertedDir = '/files/converted-pdf/';

        if (!is_dir($_SERVER['DOCUMENT_ROOT'] . $convertedDir)) {
            mkdir($_SERVER['DOCUMENT_ROOT'] . $convertedDir, 0755);
        }

        $filePath = $_SERVER['DOCUMENT_ROOT'] . '/files/' . $file;
        $name = explode('.', $file)[0];
        $convertedImages = [];

        // if images already converted return them
        $jsonImages = null;
        if (file_exists($_SERVER['DOCUMENT_ROOT'].$convertedDir.$name.'_manifest.json'))
            $jsonImages = file_get_contents($_SERVER['DOCUMENT_ROOT'].$convertedDir.$name.'_manifest.json');
        if ($jsonImages) {
            $images = json_decode($jsonImages);

            if (count($images) > 0) {
                $isNotFound = false;

                foreach ($images as $image) {
                    if (!file_exists($_SERVER['DOCUMENT_ROOT'] . $image)) {
                        $isNotFound = true;
                    }
                }

                if (!$isNotFound) {
                    return $images;
                }
            }
        }

        if (!extension_loaded('imagick'))
            throw new Error('imagick is not installed');

        $im = new \Imagick();
        $im->readImage($filePath);
        $im->setFirstIterator();

        $numPages = $im->getNumberImages();

        $i = 0;
        while($i < $numPages)
        {
            $path = $convertedDir.$name.'_'.$i.'_converted.jpg';
            $absolutePath = $_SERVER['DOCUMENT_ROOT'] . $path;

            if (file_exists($absolutePath)) {
                $convertedImages[] = $path;
            } else {
                $im = new \Imagick();
                $im->setResolution(144, 144);
                $im->readImage($filePath.'['.$i.']');
                $im = $im->flattenImages();
//                $im->writeImage($absolutePath);
                $im->setImageFormat('jpg');
                file_put_contents($absolutePath, $im);
                $convertedImages[] = $path;
            }
            $i++;
        }

        file_put_contents($_SERVER['DOCUMENT_ROOT'].$convertedDir.$name.'_manifest.json', json_encode($convertedImages));

        return $convertedImages;
    }
}
