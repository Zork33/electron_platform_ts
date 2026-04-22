from configs import image_cropper as image_cropper_config
from toolkit.adapter.image_cropper_pillow.adapter import ImageCropperPillow
from toolkit.tool.image_cropper.tool import ImageCropper


def create_image_cropper() -> ImageCropper:
    adapter = ImageCropperPillow("image_cropper", image_cropper_config.crop_config())
    image_cropper = ImageCropper("image_cropper", cropper_adapter=adapter)
    print("Image cropper initialized successfully")
    return image_cropper
