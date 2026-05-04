docker run --rm -it --name cdt \
  --volume $(pwd)/:/project \
  -w /project \
  dicoop/blockchain:latest /bin/bash
