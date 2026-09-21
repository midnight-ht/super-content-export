Add-Type -AssemblyName System.Drawing

$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$assets = Join-Path $root 'store-assets'
$source = Join-Path $assets 'source'
$screenshots = Join-Path $assets 'screenshots'
$promotional = Join-Path $assets 'promotional'

function New-Font([string]$family, [float]$size, [System.Drawing.FontStyle]$style = [System.Drawing.FontStyle]::Regular) {
  New-Object System.Drawing.Font($family, $size, $style, [System.Drawing.GraphicsUnit]::Pixel)
}

function New-Canvas([int]$width, [int]$height) {
  $bitmap = New-Object System.Drawing.Bitmap($width, $height)
  $bitmap.SetResolution(96, 96)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::ClearTypeGridFit
  return @($bitmap, $graphics)
}

function Save-Canvas($canvas, [string]$path) {
  $canvas[1].Dispose()
  $canvas[0].Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $canvas[0].Dispose()
}

function Draw-RoundedRect($graphics, [System.Drawing.Brush]$brush, [float]$x, [float]$y, [float]$width, [float]$height, [float]$radius) {
  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  $diameter = $radius * 2
  $path.AddArc($x, $y, $diameter, $diameter, 180, 90)
  $path.AddArc($x + $width - $diameter, $y, $diameter, $diameter, 270, 90)
  $path.AddArc($x + $width - $diameter, $y + $height - $diameter, $diameter, $diameter, 0, 90)
  $path.AddArc($x, $y + $height - $diameter, $diameter, $diameter, 90, 90)
  $path.CloseFigure()
  $graphics.FillPath($brush, $path)
  $path.Dispose()
}

function Draw-Text($graphics, [string]$text, [string]$family, [float]$size, [System.Drawing.FontStyle]$style, [System.Drawing.Brush]$brush, [float]$x, [float]$y, [float]$width, [float]$height) {
  $font = New-Font $family $size $style
  $format = New-Object System.Drawing.StringFormat
  $format.Trimming = [System.Drawing.StringTrimming]::EllipsisCharacter
  $rectangle = New-Object -TypeName System.Drawing.RectangleF -ArgumentList $x, $y, $width, $height
  $graphics.DrawString($text, $font, $brush, $rectangle, $format)
  $format.Dispose()
  $font.Dispose()
}

function Draw-ImageCard($graphics, $image, [float]$x, [float]$y, [float]$width, [float]$height) {
  $shadow = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(45, 30, 65, 110))
  Draw-RoundedRect $graphics $shadow ($x + 12) ($y + 14) $width $height 18
  $shadow.Dispose()
  $card = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
  Draw-RoundedRect $graphics $card $x $y $width $height 18
  $card.Dispose()
  $rectangle = New-Object -TypeName System.Drawing.RectangleF -ArgumentList ($x + 10), ($y + 10), ($width - 20), ($height - 20)
  $graphics.DrawImage($image, $rectangle)
}

function Draw-Chip($graphics, [string]$text, [string]$family, [float]$x, [float]$y, [float]$width) {
  $brush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(22, 44, 102, 223))
  Draw-RoundedRect $graphics $brush $x $y $width 38 19
  $brush.Dispose()
  $font = New-Font $family 17 ([System.Drawing.FontStyle]::Bold)
  $textBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(38, 92, 224))
  $format = New-Object System.Drawing.StringFormat
  $format.Alignment = [System.Drawing.StringAlignment]::Center
  $format.LineAlignment = [System.Drawing.StringAlignment]::Center
  $rectangle = New-Object -TypeName System.Drawing.RectangleF -ArgumentList $x, $y, $width, 38
  $graphics.DrawString($text, $font, $textBrush, $rectangle, $format)
  $format.Dispose(); $font.Dispose(); $textBrush.Dispose()
}

function New-ListingScreenshot([string]$locale) {
  $canvas = New-Canvas 1280 800
  $bitmap = $canvas[0]; $graphics = $canvas[1]
  $pointA = New-Object -TypeName System.Drawing.Point -ArgumentList 0, 0
  $pointB = New-Object -TypeName System.Drawing.Point -ArgumentList 1280, 800
  $gradient = New-Object System.Drawing.Drawing2D.LinearGradientBrush -ArgumentList $pointA, $pointB, ([System.Drawing.Color]::FromArgb(247, 250, 255)), ([System.Drawing.Color]::FromArgb(224, 237, 255))
  $graphics.FillRectangle($gradient, 0, 0, 1280, 800)
  $gradient.Dispose()
  $blue = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(38, 92, 224))
  $dark = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(18, 31, 58))
  $muted = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(84, 106, 143))
  $family = if ($locale -eq 'zh-CN') { 'Microsoft YaHei' } else { 'Segoe UI' }
  if ($locale -eq 'zh-CN') {
    Draw-Text $graphics 'SuperContentExport' $family 48 ([System.Drawing.FontStyle]::Bold) $blue 64 72 650 66
    Draw-Text $graphics '选中内容，快速导出' $family 32 ([System.Drawing.FontStyle]::Bold) $dark 68 164 610 52
    Draw-Text $graphics '可视化选择网页元素，复制或导出 Markdown，也可保存为 PNG。' $family 22 ([System.Drawing.FontStyle]::Regular) $muted 68 232 610 86
    Draw-Chip $graphics 'Markdown' $family 68 350 150
    Draw-Chip $graphics 'PNG' $family 234 350 100
    Draw-Chip $graphics '长图处理' $family 350 350 150
  } else {
    Draw-Text $graphics 'SuperContentExport' $family 48 ([System.Drawing.FontStyle]::Bold) $blue 64 72 650 66
    Draw-Text $graphics 'Select once. Export cleanly.' $family 32 ([System.Drawing.FontStyle]::Bold) $dark 68 164 610 52
    Draw-Text $graphics 'Pick webpage content, copy or download Markdown, and save it as PNG.' $family 22 ([System.Drawing.FontStyle]::Regular) $muted 68 232 610 86
    Draw-Chip $graphics 'Markdown' $family 68 350 150
    Draw-Chip $graphics 'PNG' $family 234 350 100
    Draw-Chip $graphics 'Long pages' $family 350 350 150
  }
  $line = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(45, 92, 224), 2)
  $graphics.DrawLine($line, 68, 468, 642, 468); $line.Dispose()
  $foot = if ($locale -eq 'zh-CN') { '本地处理 · 中英文界面 · Chrome Manifest V3' } else { 'Local processing · Bilingual UI · Chrome Manifest V3' }
  Draw-Text $graphics $foot $family 18 ([System.Drawing.FontStyle]::Regular) $muted 68 492 620 40
  $sourceName = 'en-US-popup.png'
  if ($locale -eq 'zh-CN') { $sourceName = 'zh-CN-popup.png' }
  $sourcePath = Join-Path $source $sourceName
  $sourceImage = [System.Drawing.Image]::FromFile($sourcePath)
  Draw-ImageCard $graphics $sourceImage 760 54 430 646
  $sourceImage.Dispose()
  $outputName = 'en-US-01.png'
  if ($locale -eq 'zh-CN') { $outputName = 'zh-CN-01.png' }
  $output = Join-Path $screenshots $outputName
  Save-Canvas @($bitmap, $graphics) $output
}

function New-PromoTile([string]$locale) {
  $canvas = New-Canvas 440 280
  $bitmap = $canvas[0]; $graphics = $canvas[1]
  $pointA = New-Object -TypeName System.Drawing.Point -ArgumentList 0, 0
  $pointB = New-Object -TypeName System.Drawing.Point -ArgumentList 440, 280
  $gradient = New-Object System.Drawing.Drawing2D.LinearGradientBrush -ArgumentList $pointA, $pointB, ([System.Drawing.Color]::FromArgb(34, 83, 205)), ([System.Drawing.Color]::FromArgb(96, 161, 246))
  $graphics.FillRectangle($gradient, 0, 0, 440, 280); $gradient.Dispose()
  $icon = [System.Drawing.Image]::FromFile((Join-Path $assets 'icon-128.png'))
  $iconRectangle = New-Object -TypeName System.Drawing.Rectangle -ArgumentList 28, 28, 74, 74
  $graphics.DrawImage($icon, $iconRectangle); $icon.Dispose()
  $family = if ($locale -eq 'zh-CN') { 'Microsoft YaHei' } else { 'Segoe UI' }
  $white = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
  $soft = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(225, 239, 255))
  Draw-Text $graphics 'SuperContentExport' $family 23 ([System.Drawing.FontStyle]::Bold) $white 118 33 290 36
  if ($locale -eq 'zh-CN') {
    Draw-Text $graphics '网页内容导出助手' $family 21 ([System.Drawing.FontStyle]::Regular) $soft 30 130 380 34
    Draw-Text $graphics '选择 · Markdown · PNG' $family 18 ([System.Drawing.FontStyle]::Bold) $white 30 190 380 36
    Draw-Text $graphics 'Chrome 扩展' $family 15 ([System.Drawing.FontStyle]::Regular) $soft 30 235 380 25
  } else {
    Draw-Text $graphics 'Web content export assistant' $family 19 ([System.Drawing.FontStyle]::Regular) $soft 30 130 380 34
    Draw-Text $graphics 'Pick · Markdown · PNG' $family 19 ([System.Drawing.FontStyle]::Bold) $white 30 190 380 36
    Draw-Text $graphics 'Chrome extension' $family 15 ([System.Drawing.FontStyle]::Regular) $soft 30 235 380 25
  }
  $outputName = 'en-US-small-tile.png'
  if ($locale -eq 'zh-CN') { $outputName = 'zh-CN-small-tile.png' }
  $output = Join-Path $promotional $outputName
  Save-Canvas @($bitmap, $graphics) $output
}

function New-Marquee([string]$locale) {
  $canvas = New-Canvas 1400 560
  $bitmap = $canvas[0]; $graphics = $canvas[1]
  $pointA = New-Object -TypeName System.Drawing.Point -ArgumentList 0, 0
  $pointB = New-Object -TypeName System.Drawing.Point -ArgumentList 1400, 560
  $gradient = New-Object System.Drawing.Drawing2D.LinearGradientBrush -ArgumentList $pointA, $pointB, ([System.Drawing.Color]::FromArgb(245, 249, 255)), ([System.Drawing.Color]::FromArgb(207, 225, 255))
  $graphics.FillRectangle($gradient, 0, 0, 1400, 560); $gradient.Dispose()
  $family = if ($locale -eq 'zh-CN') { 'Microsoft YaHei' } else { 'Segoe UI' }
  $blue = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(38, 92, 224))
  $dark = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(18, 31, 58))
  $muted = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(84, 106, 143))
  $icon = [System.Drawing.Image]::FromFile((Join-Path $assets 'icon-128.png'))
  $iconRectangle = New-Object -TypeName System.Drawing.Rectangle -ArgumentList 74, 76, 92, 92
  $graphics.DrawImage($icon, $iconRectangle); $icon.Dispose()
  Draw-Text $graphics 'SuperContentExport' $family 50 ([System.Drawing.FontStyle]::Bold) $blue 190 82 720 72
  if ($locale -eq 'zh-CN') {
    Draw-Text $graphics '网页内容导出助手' $family 32 ([System.Drawing.FontStyle]::Bold) $dark 80 226 680 55
    Draw-Text $graphics '选择网页元素，复制或导出 Markdown，也可以保存为 PNG。' $family 23 ([System.Drawing.FontStyle]::Regular) $muted 80 302 700 80
  } else {
    Draw-Text $graphics 'Web content export assistant' $family 32 ([System.Drawing.FontStyle]::Bold) $dark 80 226 680 55
    Draw-Text $graphics 'Pick webpage elements, copy or export Markdown, and save PNGs.' $family 23 ([System.Drawing.FontStyle]::Regular) $muted 80 302 700 80
  }
  $sourceName = 'en-US-popup.png'
  if ($locale -eq 'zh-CN') { $sourceName = 'zh-CN-popup.png' }
  $sourcePath = Join-Path $source $sourceName
  $sourceImage = [System.Drawing.Image]::FromFile($sourcePath)
  Draw-ImageCard $graphics $sourceImage 1000 54 318 434
  $sourceImage.Dispose()
  $outputName = 'en-US-marquee.png'
  if ($locale -eq 'zh-CN') { $outputName = 'zh-CN-marquee.png' }
  $output = Join-Path $promotional $outputName
  Save-Canvas @($bitmap, $graphics) $output
}

New-ListingScreenshot 'en-US'
New-ListingScreenshot 'zh-CN'
New-PromoTile 'en-US'
New-PromoTile 'zh-CN'
New-Marquee 'en-US'
New-Marquee 'zh-CN'
Write-Output 'Generated Chrome Web Store image assets.'
