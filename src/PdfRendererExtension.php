<?php

namespace Bolt\Extension\GTaRR\PdfRenderer;

use Bolt\Asset\File\JavaScript;
use Bolt\Asset\File\Stylesheet;
use Bolt\Extension\SimpleExtension;
use Bolt\Filesystem\FilesystemInterface;

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
            new Stylesheet('extension.css'),
            new JavaScript('extension.js'),
        ];
    }

    /**
     * {@inheritdoc}
     */
    protected function registerTwigFunctions()
    {
        return [
            'fromPDFImages' => 'fromPDFImages',
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
     * {@inheritdoc}
     */
    protected function registerFrontendRoutes(ControllerCollection $collection)
    {
        $collection->match('/pdf-convert', [$this, 'callbackPdfConvert']);
    }

    /**
     * The callback function when {{ my_twig_function() }} is used in a template.
     *
     * @return string
     */
    public function fromPDFImages()
    {
        $context = [
            'pdf_images' => mt_rand() . 'test',
        ];

        return $this->renderTemplate('pdf_images.twig', $context);
    }

    /**
     * @param Application $app
     * @param Request     $request
     *
     * @return Response
     */
    public function callbackPdfConvert(Application $app, Request $request)
    {
        return new Response('Drop bear sighted!', Response::HTTP_OK);
    }

    public function renderImages($pdfFile)
    {
        $mountPointName = 'files';

        /** @var \Bolt\Filesystem\Manager $manager */
        $manager = $app['filesystem'];

        $im = new imagick();
        $im->readImage('file.pdf');

        $i = 0;
        while($im->hasNextImage())
        {
            $im->writeImage(++$i.'-converted.jpg');
            $im->nextImage();
        }
        $im->setImageFormat('jpg');
    }
}
